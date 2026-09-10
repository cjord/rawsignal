import { createHash, createVerify } from "node:crypto";

import { EBAY_SCOPE, EBAY_TOKEN_URL } from "../core/clients/ebay-browse.ts";

export const EBAY_ACCOUNT_DELETION_PATH = "/api/ebay/account-deletion";
export const EBAY_PUBLIC_KEY_URL = "https://api.ebay.com/commerce/notification/v1/public_key";

const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SIGNATURE_HEADER_BYTES = 8 * 1024;
const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,80}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export interface EbayAccountDeletionEnv {
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_DELETION_VERIFICATION_TOKEN?: string;
  EBAY_DELETION_ENDPOINT_URL?: string;
}

export interface EbayAccountDeletionData {
  username?: string;
  userId?: string;
  eiasToken?: string;
}

interface EbayAccountDeletionNotification {
  metadata: {
    topic: "MARKETPLACE_ACCOUNT_DELETION";
    schemaVersion?: string;
    deprecated?: boolean;
  };
  notification: {
    notificationId: string;
    eventDate?: string;
    publishDate?: string;
    publishAttemptCount?: number;
    data: EbayAccountDeletionData;
  };
}

interface SignatureEnvelope {
  alg: "ecdsa";
  kid: string;
  signature: string;
  digest: "SHA1";
}

interface PublicKeyResponse {
  key: string;
  algorithm: "ECDSA";
  digest: "SHA1";
}

interface HandlerDeps {
  fetch?: typeof fetch;
  now?: () => number;
  processDeletion?: (data: EbayAccountDeletionData, notificationId: string) => Promise<void>;
}

const json = (body: unknown, status: number, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...RESPONSE_HEADERS, ...extraHeaders, "Content-Type": "application/json" },
});

const response = (status: number, extraHeaders: Record<string, string> = {}) => new Response(null, {
  status,
  headers: { ...RESPONSE_HEADERS, ...extraHeaders },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validOptionalString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length > 0 && value.length <= 1024);
}

function parseNotification(value: unknown): EbayAccountDeletionNotification | null {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.notification) || !isRecord(value.notification.data)) return null;
  if (value.metadata.topic !== "MARKETPLACE_ACCOUNT_DELETION") return null;
  if (typeof value.notification.notificationId !== "string" || value.notification.notificationId.length < 1 || value.notification.notificationId.length > 256) return null;
  const { username, userId, eiasToken } = value.notification.data;
  if (!validOptionalString(username) || !validOptionalString(userId) || !validOptionalString(eiasToken)) return null;
  if (username === undefined && userId === undefined && eiasToken === undefined) return null;
  return value as unknown as EbayAccountDeletionNotification;
}

function decodeBase64(value: string): Buffer | null {
  if (!value || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length ? decoded : null;
  } catch {
    return null;
  }
}

export function parseEbaySignatureHeader(header: string | null): SignatureEnvelope | null {
  if (!header || header.length > MAX_SIGNATURE_HEADER_BYTES) return null;
  const decoded = decodeBase64(header);
  if (!decoded) return null;
  try {
    const value = JSON.parse(decoded.toString("utf8")) as unknown;
    if (!isRecord(value) || typeof value.alg !== "string" || value.alg.toLowerCase() !== "ecdsa") return null;
    if (typeof value.kid !== "string" || !KEY_ID_PATTERN.test(value.kid)) return null;
    if (value.digest !== "SHA1" || typeof value.signature !== "string" || !decodeBase64(value.signature)) return null;
    return { alg: "ecdsa", kid: value.kid, signature: value.signature, digest: "SHA1" };
  } catch {
    return null;
  }
}

function normalizedPublicKey(value: unknown): PublicKeyResponse | null {
  if (!isRecord(value) || typeof value.key !== "string" || value.algorithm !== "ECDSA" || value.digest !== "SHA1") return null;
  const body = value.key
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!decodeBase64(body)) return null;
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return { key: `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`, algorithm: "ECDSA", digest: "SHA1" };
}

function configuredEndpoint(request: Request, configured: string | undefined): string | null {
  try {
    const url = configured?.trim() ? new URL(configured.trim()) : new URL(request.url);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== EBAY_ACCOUNT_DELETION_PATH) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function ebayChallengeResponse(challengeCode: string, verificationToken: string, endpoint: string): string {
  return createHash("sha256").update(challengeCode).update(verificationToken).update(endpoint).digest("hex");
}

// Raw Signal does not persist eBay usernames, immutable user IDs, EIAS tokens, orders, or
// user OAuth tokens. This processor is intentionally a no-op today. Keep it as the single
// deletion boundary: any future user-linked eBay storage must be deleted here before the
// notification is acknowledged.
export async function deleteStoredEbayUserData(data: EbayAccountDeletionData, notificationId: string): Promise<void> {
  void data;
  void notificationId;
  return Promise.resolve();
}

export function createEbayAccountDeletionHandler(deps: HandlerDeps = {}) {
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const processDeletion = deps.processDeletion ?? deleteStoredEbayUserData;
  const publicKeys = new Map<string, { key: string; expiresAt: number }>();
  let token: { clientId: string; value: string; expiresAt: number } | null = null;

  async function bearer(env: EbayAccountDeletionEnv, force = false): Promise<string> {
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) throw new Error("missing_credentials");
    if (!force && token?.clientId === env.EBAY_CLIENT_ID && token.expiresAt - TOKEN_REFRESH_MARGIN_MS > now()) return token.value;
    const auth = Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`, "utf8").toString("base64");
    const tokenResponse = await fetcher(EBAY_TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_SCOPE }).toString(),
    });
    if (!tokenResponse.ok) throw new Error(`token_http_${tokenResponse.status}`);
    const body = await tokenResponse.json().catch(() => null) as { access_token?: unknown; expires_in?: unknown } | null;
    if (typeof body?.access_token !== "string" || !body.access_token) throw new Error("invalid_token_response");
    const lifetime = Number(body.expires_in);
    token = {
      clientId: env.EBAY_CLIENT_ID,
      value: body.access_token,
      expiresAt: now() + (Number.isFinite(lifetime) && lifetime > 0 ? lifetime * 1000 : 7_200_000),
    };
    return token.value;
  }

  async function publicKey(kid: string, env: EbayAccountDeletionEnv, retried = false): Promise<string> {
    const cached = publicKeys.get(kid);
    if (cached && cached.expiresAt > now()) return cached.key;
    const keyResponse = await fetcher(`${EBAY_PUBLIC_KEY_URL}/${encodeURIComponent(kid)}`, {
      headers: { Authorization: `Bearer ${await bearer(env, retried)}`, Accept: "application/json" },
    });
    if ((keyResponse.status === 401 || keyResponse.status === 403) && !retried) {
      token = null;
      return publicKey(kid, env, true);
    }
    if (!keyResponse.ok) throw new Error(`public_key_http_${keyResponse.status}`);
    const key = normalizedPublicKey(await keyResponse.json().catch(() => null));
    if (!key) throw new Error("invalid_public_key_response");
    publicKeys.set(kid, { key: key.key, expiresAt: now() + PUBLIC_KEY_TTL_MS });
    return key.key;
  }

  return async function handleEbayAccountDeletion(request: Request, env: EbayAccountDeletionEnv): Promise<Response> {
    if (request.method === "GET") {
      const verificationToken = env.EBAY_DELETION_VERIFICATION_TOKEN ?? "";
      const endpoint = configuredEndpoint(request, env.EBAY_DELETION_ENDPOINT_URL);
      if (!VERIFICATION_TOKEN_PATTERN.test(verificationToken) || !endpoint) return json({ error: "Endpoint is not configured" }, 503);
      const challengeCode = new URL(request.url).searchParams.get("challenge_code");
      if (!challengeCode || challengeCode.length > 1024) return json({ error: "Invalid challenge code" }, 400);
      return json({ challengeResponse: ebayChallengeResponse(challengeCode, verificationToken, endpoint) }, 200);
    }

    if (request.method !== "POST") return response(405, { Allow: "GET, POST" });
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return json({ error: "Endpoint is not configured" }, 503);
    if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return json({ error: "JSON body required" }, 415);
    const declaredLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid notification" }, 400);
    }
    const notification = parseNotification(parsed);
    if (!notification) return json({ error: "Invalid notification" }, 400);
    const signature = parseEbaySignatureHeader(request.headers.get("X-EBAY-SIGNATURE"));
    if (!signature) return response(412);

    try {
      // eBay's reference SDK verifies JSON.stringify(parsedMessage), so use the same
      // canonical input rather than depending on transport whitespace.
      const verifier = createVerify("sha1");
      verifier.update(JSON.stringify(parsed));
      verifier.end();
      const verified = verifier.verify(await publicKey(signature.kid, env), signature.signature, "base64");
      if (!verified) return response(412);
      await processDeletion(notification.notification.data, notification.notification.notificationId);
      return response(204);
    } catch (error) {
      // Never log the notification or account identifiers. A non-success response asks
      // eBay to retry transient token/public-key or processing failures.
      console.error(JSON.stringify({ event: "ebay_account_deletion_failed", message: error instanceof Error ? error.message : "unknown_failure" }));
      return response(503, { "Retry-After": "60" });
    }
  };
}

const defaultHandler = createEbayAccountDeletionHandler();

export const handleEbayAccountDeletion = (request: Request, env: EbayAccountDeletionEnv) => defaultHandler(request, env);
