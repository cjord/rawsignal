import {appendFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {buildDigest, digestMarker} from "./digest.mjs";
import {createGitHubApi, listAllIssues} from "./github-api.mjs";

export async function runDigest({env = process.env, api, now = new Date()} = {}) {
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) throw new Error("Set GITHUB_REPOSITORY to owner/repository");
  const publish = env.DIGEST_PUBLISH === "true";
  if (publish && (env.GITHUB_ACTIONS !== "true" || !env.DIGEST_DEFAULT_BRANCH
    || env.GITHUB_REF !== `refs/heads/${env.DIGEST_DEFAULT_BRANCH}`)) {
    throw new Error("Publishing requires a trusted default-branch Actions run");
  }
  const client = api ?? createGitHubApi(env.GH_TOKEN);
  const metadata = await client(`/repos/${repository}`);
  if (metadata.private !== true) throw new Error("This workflow is approved for a private repository only");
  const issues = await listAllIssues(client, repository);
  const digest = buildDigest(issues, repository, now);
  const existing = issues.filter(issue => !issue.pull_request && issue.body?.includes(digestMarker(digest.key)));
  if (existing.length > 1) throw new Error("Multiple digest issues found; reconcile manually before publishing");
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, `${digest.body}\n`);
  if (!publish) return {status: "preview", key: digest.key, issueCount: issues.length};
  if (existing.length) return {status: "already-exists", key: digest.key};
  await client(`/repos/${repository}/issues`, {method: "POST", body: {
    title: digest.title, body: digest.body, labels: digest.labels,
  }});
  return {status: "created", key: digest.key};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDigest().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
