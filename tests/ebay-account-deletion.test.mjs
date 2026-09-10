import assert from "node:assert/strict";
import test from "node:test";

import { EBAY_TOKEN_URL } from "../core/clients/ebay-browse.ts";
import {
  EBAY_ACCOUNT_DELETION_PATH,
  EBAY_PUBLIC_KEY_URL,
  createEbayAccountDeletionHandler,
  ebayChallengeResponse,
  parseEbaySignatureHeader,
} from "../worker/ebay-account-deletion.ts";

const ENDPOINT = `https://rawsignal.cards${EBAY_ACCOUNT_DELETION_PATH}`;
const VERIFICATION_TOKEN = "verification-token-1234567890-ABCDE";
const CLIENT_ENV = { EBAY_CLIENT_ID: "client-id", EBAY_CLIENT_SECRET: "client-secret" };

// Public fixture published in eBay's official event-notification-nodejs-sdk test suite.
const EBAY_SIGNATURE = "eyJhbGciOiJlY2RzYSIsImtpZCI6Ijk5MzYyNjFhLTdkN2ItNDYyMS1hMGYxLTk2Y2NiNDI4YWY0OSIsInNpZ25hdHVyZSI6Ik1FWUNJUUNmeGZJV3V4bVdjSUJRSjljNS9YN2lHREpxczJSQ0dzQkVhQWppbnlycmZBSWhBSVY2d0djVGlCdVY1S0pVaWYyaG9reXJMK1E5c3NIa2FkK214Mm5FRTI1dyIsImRpZ2VzdCI6IlNIQTEifQ==";
const EBAY_KID = "9936261a-7d7b-4621-a0f1-96ccb428af49";
const EBAY_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZhhxXKtR+TOvtDbgTPCkSof02qgBB7IsYOyf76ilExJ/upAa/vKIKheOoCyOpcLmi4t0b4uepb7LLjmMr90FUg==-----END PUBLIC KEY-----";
const EBAY_NOTIFICATION = {
  metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
  notification: {
    notificationId: "49feeaeb-4982-42d9-a377-9645b8479411_33f7e043-fed8-442b-9d44-791923bd9a6d",
    eventDate: "2021-03-19T20:43:59.462Z",
    publishDate: "2021-03-19T20:43:59.679Z",
    publishAttemptCount: 1,
    data: {
      username: "test_user",
      userId: "ma8vp1jySJC",
      eiasToken: "nY+sHZ2PrBmdj6wVnY+sEZ2PrA2dj6wJnY+gAZGEpwmdj6x9nY+seQ==",
    },
  },
};

function signedRequest(body = EBAY_NOTIFICATION, signature = EBAY_SIGNATURE) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-EBAY-SIGNATURE": signature },
    body: JSON.stringify(body),
  });
}

function fakeEbay() {
  const requests = [];
  const fetcher = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url) === EBAY_TOKEN_URL) return Response.json({ access_token: "app-token", expires_in: 7200 });
    if (String(url) === `${EBAY_PUBLIC_KEY_URL}/${EBAY_KID}`) return Response.json({ key: EBAY_PUBLIC_KEY, algorithm: "ECDSA", digest: "SHA1" });
    return new Response(null, { status: 404 });
  };
  return { fetcher, requests };
}

test("challenge response uses eBay's exact hash order and configured endpoint", async () => {
  assert.equal(
    ebayChallengeResponse("challenge-123", VERIFICATION_TOKEN, ENDPOINT),
    "9be5c5016e8b9098add620be2e4f35bc99405fda7b709d0a4501bbac179d21d9",
  );
  const handler = createEbayAccountDeletionHandler();
  const result = await handler(
    new Request(`https://untrusted.example${EBAY_ACCOUNT_DELETION_PATH}?challenge_code=challenge-123`),
    { EBAY_DELETION_VERIFICATION_TOKEN: VERIFICATION_TOKEN, EBAY_DELETION_ENDPOINT_URL: ENDPOINT },
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await result.json(), { challengeResponse: "9be5c5016e8b9098add620be2e4f35bc99405fda7b709d0a4501bbac179d21d9" });
});

test("challenge endpoint rejects missing challenge and invalid configuration", async () => {
  const handler = createEbayAccountDeletionHandler();
  assert.equal((await handler(new Request(ENDPOINT), { EBAY_DELETION_VERIFICATION_TOKEN: VERIFICATION_TOKEN })).status, 400);
  assert.equal((await handler(new Request(`${ENDPOINT}?challenge_code=x`), { EBAY_DELETION_VERIFICATION_TOKEN: "too-short" })).status, 503);
  assert.equal((await handler(new Request(`http://rawsignal.cards${EBAY_ACCOUNT_DELETION_PATH}?challenge_code=x`), { EBAY_DELETION_VERIFICATION_TOKEN: VERIFICATION_TOKEN })).status, 503);
});

test("valid signed deletion notifications are processed and eBay's public key is cached", async () => {
  const ebay = fakeEbay();
  const processed = [];
  const handler = createEbayAccountDeletionHandler({
    fetch: ebay.fetcher,
    now: () => Date.parse("2026-09-10T12:00:00Z"),
    processDeletion: async (data, notificationId) => processed.push({ data, notificationId }),
  });

  const first = await handler(signedRequest(), CLIENT_ENV);
  const second = await handler(signedRequest(), CLIENT_ENV);
  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  assert.equal(processed.length, 2);
  assert.deepEqual(processed[0], { data: EBAY_NOTIFICATION.notification.data, notificationId: EBAY_NOTIFICATION.notification.notificationId });
  assert.equal(ebay.requests.filter(request => request.url === EBAY_TOKEN_URL).length, 1);
  assert.equal(ebay.requests.filter(request => request.url.startsWith(EBAY_PUBLIC_KEY_URL)).length, 1);
  assert.equal(ebay.requests[0].init.headers.Authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
});

test("invalid signatures, topics, content types, and methods are never processed", async () => {
  const ebay = fakeEbay();
  let processed = 0;
  const handler = createEbayAccountDeletionHandler({ fetch: ebay.fetcher, processDeletion: async () => { processed += 1; } });
  const envelope = parseEbaySignatureHeader(EBAY_SIGNATURE);
  assert.deepEqual(envelope && { alg: envelope.alg, kid: envelope.kid, digest: envelope.digest }, { alg: "ecdsa", kid: EBAY_KID, digest: "SHA1" });

  const invalidSignature = Buffer.from(JSON.stringify({ ...envelope, signature: Buffer.from("not-a-signature").toString("base64") })).toString("base64");
  assert.equal((await handler(signedRequest(EBAY_NOTIFICATION, invalidSignature), CLIENT_ENV)).status, 412);
  assert.equal((await handler(signedRequest({ ...EBAY_NOTIFICATION, metadata: { ...EBAY_NOTIFICATION.metadata, topic: "OTHER" } }), CLIENT_ENV)).status, 400);
  assert.equal((await handler(new Request(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" }), CLIENT_ENV)).status, 415);
  const method = await handler(new Request(ENDPOINT, { method: "DELETE" }), CLIENT_ENV);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("Allow"), "GET, POST");
  assert.equal(processed, 0);
});

test("transient token or public-key failures return a retryable error without processing", async () => {
  let processed = false;
  const handler = createEbayAccountDeletionHandler({
    fetch: async url => String(url) === EBAY_TOKEN_URL ? new Response(null, { status: 401 }) : new Response(null, { status: 500 }),
    processDeletion: async () => { processed = true; },
  });
  const result = await handler(signedRequest(), CLIENT_ENV);
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("Retry-After"), "60");
  assert.equal(processed, false);
});
