import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {load as yaml} from "js-yaml";
import {weekKey, digestMarker, buildDigest} from "../scripts/github/digest.mjs";
import {createGitHubApi, listAllIssues} from "../scripts/github/github-api.mjs";
import {runDigest} from "../scripts/github/weekly-digest.mjs";
import {loadPilot, renderPilot} from "../scripts/github/backlog-preview.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const now = new Date("2026-10-26T13:00:00Z");
const env = {GITHUB_REPOSITORY: "owner/repo", GITHUB_ACTIONS: "true",
  GITHUB_REF: "refs/heads/main", DIGEST_DEFAULT_BRANCH: "main", DIGEST_PUBLISH: "true"};
const task = (number, labels = ["state:triage"], extra = {}) => ({number, title: `Task ${number}`, state: "open", labels, ...extra});

test("week keys use Eastern Monday across DST and UTC boundaries", () => {
  for (const [instant, key] of [
    ["2026-10-26T03:59:00Z", "2026-10-19"],
    ["2026-10-26T04:00:00Z", "2026-10-26"],
    ["2026-11-02T04:59:00Z", "2026-10-26"],
    ["2026-11-02T05:00:00Z", "2026-11-02"],
    ["2026-03-09T13:00:00Z", "2026-03-09"],
    ["2027-01-01T15:00:00Z", "2026-12-28"],
  ]) assert.equal(weekKey(new Date(instant)), key);
});

test("digest excludes deferred work, PRs and earlier digests and escapes titles", () => {
  const result = buildDigest([
    task(1, ["state:active"], {title: "<script> @everyone [link](evil)"}),
    task(2, ["state:deferred"]), task(3, ["type:digest"]),
    task(4, [], {pull_request: {}}), task(5, [], {body: digestMarker("old")}),
    task(6, [], {state: "closed", closed_at: "2026-10-25T00:00:00Z"}),
    task(7, [], {state: "closed", closed_at: "2026-10-01T00:00:00Z"}),
  ], "owner/repo", now);
  assert.match(result.body, /issues\/1/);
  assert.match(result.body, /issues\/6/);
  for (const number of [2, 3, 4, 5, 7]) assert.doesNotMatch(result.body, new RegExp(`issues/${number}\\)`));
  assert.doesNotMatch(result.body, /<script>|@everyone|\[link\]/);
  assert.match(result.body, /&lt;script&gt;/);
  assert.equal(result.key, "2026-10-26");
  assert.throws(() => buildDigest([], "bad/repo?token=x"), /Invalid repository/);
});

test("digest sections report explicit overflow", () => {
  const result = buildDigest(Array.from({length: 70}, (_, index) => task(index + 1)), "owner/repo", now);
  assert.match(result.body, /Needs triage \(70\)/);
  assert.match(result.body, /first 60/);
  assert.throws(() => buildDigest(["state:active", "state:ready", "state:blocked", "state:triage"].flatMap(
    label => Array.from({length: 60}, (_, index) => task(index + 1, [label], {title: "<".repeat(200)})),
  ), "owner/repo", now), /safe issue size/);
});

test("API does not retry writes or expose private response bodies", async () => {
  let calls = 0;
  const api = createGitHubApi("fixture-secret", async (_url, options) => {
    calls++;
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer fixture-secret");
    return {ok: false, status: 500, json: () => {throw new Error("private body must not be read");}};
  });
  await assert.rejects(api("/repos/owner/repo/issues", {method: "POST", body: {}}), /500/);
  assert.equal(calls, 1);
  await assert.rejects(api("https://untrusted.invalid"), /Unexpected API path/);
  assert.equal(calls, 1);
  assert.throws(() => createGitHubApi(""), /authentication/);
  const malformed = createGitHubApi("fixture-secret", async () => ({
    ok: true, json: async () => {throw new Error("private response fragment");},
  }));
  await assert.rejects(malformed("/repos/owner/repo"), error =>
    error.message.includes("unreadable response") && !error.message.includes("private response"));
});

test("issue reads paginate and refuse partial data at the cap", async () => {
  let calls = 0;
  const result = await listAllIssues(async () => ++calls === 1 ? Array(100).fill(task(1)) : [task(2)], "owner/repo");
  assert.equal(result.length, 101);
  assert.equal(calls, 2);
  await assert.rejects(listAllIssues(async () => Array(100).fill(task(1)), "owner/repo"), /partial data/);
});

function fixtureApi(issues, privateRepo = true) {
  const writes = [];
  const api = async (path, options = {}) => {
    if (options.method === "POST") {writes.push(options.body); return {number: 99};}
    return path.includes("/issues?") ? issues : {private: privateRepo};
  };
  return {api, writes};
}

test("digest previews by default and publishes only from default-branch Actions", async () => {
  const fixture = fixtureApi([task(1)]);
  assert.equal((await runDigest({env: {GITHUB_REPOSITORY: "owner/repo"}, api: fixture.api, now})).status, "preview");
  assert.equal(fixture.writes.length, 0);
  for (const override of [{GITHUB_ACTIONS: "false"}, {GITHUB_REF: "refs/heads/feature"}, {DIGEST_DEFAULT_BRANCH: ""}]) {
    await assert.rejects(runDigest({env: {...env, ...override}, api: fixture.api, now}), /default-branch/);
  }
  assert.equal((await runDigest({env, api: fixture.api, now})).status, "created");
  assert.equal(fixture.writes.length, 1);
  assert.deepEqual(fixture.writes[0].labels, ["type:digest"]);
});

test("digest reruns leave existing issues untouched, duplicate markers fail closed", async () => {
  const issue = task(1, [], {state: "closed", body: digestMarker("2026-10-26")});
  const fixture = fixtureApi([issue]);
  assert.equal((await runDigest({env, api: fixture.api, now})).status, "already-exists");
  assert.equal(fixture.writes.length, 0);
  await assert.rejects(runDigest({env, api: fixtureApi([issue, {...issue, number: 2}]).api, now}), /Multiple digest/);
  await assert.rejects(runDigest({env, api: fixtureApi([], false).api, now}), /private repository/);
});

test("pilot validates source evidence, stable IDs, known labels and deferrals", async () => {
  const manifest = await loadPilot();
  assert.equal(manifest.status, "imported");
  assert.equal(manifest.repository, "cjord/rawsignal");
  assert.equal(manifest.visibility, "public");
  assert.equal(manifest.issues.length, 21);
  assert.equal(manifest.issues.filter(issue => issue.labels.includes("state:deferred")).length, 9);
  assert.equal(manifest.issues.filter(issue => issue.labels.includes("state:triage")).length, 12);
  for (const key of ["RS-017", "RS-018", "RS-019"]) {
    const issue = manifest.issues.find(item => item.id === key);
    assert.ok(issue.labels.includes("state:deferred"));
    assert.match(issue.scope, /no reminder/i);
  }
  assert.match(renderPilot(manifest), /rawsignal-backlog:RS-021/);
  assert.match(renderPilot(manifest), /imported source snapshot/);
  assert.doesNotMatch(renderPilot(manifest), /No issues, labels or projects have been created/);
  const receipt = await read(manifest.receipt);
  for (const issue of manifest.issues) assert.ok(receipt.includes(issue.id));
});

test("issue forms and workflow YAML parse and preserve least privilege", async () => {
  const labels = JSON.parse(await read(".github/labels.json"));
  const names = new Set(labels.map(label => label.name));
  assert.equal(names.size, labels.length);
  for (const name of ["bug", "improvement", "investigation", "maintenance"]) {
    const form = yaml(await read(`.github/ISSUE_TEMPLATE/${name}.yml`));
    assert.ok(form.name && form.description && form.body.length >= 3);
    assert.ok(form.labels.every(label => names.has(label)));
    assert.ok(form.body.some(field => field.validations?.required));
  }
  assert.equal(yaml(await read(".github/ISSUE_TEMPLATE/config.yml")).blank_issues_enabled, false);
  const quality = yaml(await read(".github/workflows/quality.yml"));
  assert.deepEqual(quality.permissions, {contents: "read"});
  assert.equal(quality.jobs.test["timeout-minutes"], 30);
  assert.ok(quality.jobs.test.steps.some(step => step.run === "npm run check"));
  const digest = yaml(await read(".github/workflows/weekly-digest.yml"));
  assert.deepEqual(digest.permissions, {contents: "read", issues: "read"});
  assert.deepEqual(digest.jobs.publish.permissions, {contents: "read", issues: "write"});
  assert.deepEqual(digest.on.schedule, [{cron: "0 9 * * 1", timezone: "America/New_York"}]);
  assert.equal(digest.on.workflow_dispatch.inputs.publish.default, false);
  assert.match(digest.jobs.publish.if, /RAW_SIGNAL_WEEKLY_DIGEST_ENABLED == 'true'/);
  assert.match(digest.jobs.publish.if, /github\.event\.repository\.default_branch/);
  assert.match(digest.jobs.preview.if, /!inputs\.publish/);
  assert.equal(digest.concurrency["cancel-in-progress"], false);
  for (const workflow of [quality, digest]) {
    assert.equal(workflow.on.pull_request_target, undefined);
    for (const step of Object.values(workflow.jobs).flatMap(job => job.steps)) {
      if (step.uses) assert.match(step.uses, /^actions\/[\w-]+@[a-f0-9]{40}$/);
      assert.doesNotMatch(step.run ?? "", /wrangler|deploy|ingestion/);
    }
  }
});

test("transition remains gated and does not override safety policies", async () => {
  const agents = await read("AGENTS.md");
  assert.match(agents, /TODO documents remain authoritative until the reviewed pilot issues have been imported and verified/);
  assert.match(agents, /never run `git push`/);
  assert.match(await read("docs/github-issues-workflow.md"), /Authority remains with TODO/);
});
