import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const root = new URL("../../", import.meta.url);

function validateImportStatus(manifest) {
  if (manifest.status === "draft-awaiting-review") return;
  if (manifest.status !== "imported" || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.importedOn ?? "")
    || manifest.repository !== "cjord/rawsignal" || manifest.visibility !== "public"
    || manifest.receipt !== "docs/github-backlog-import-2026-10-23.md") throw new Error("Unexpected pilot import metadata");
}

export async function loadPilot() {
  const manifest = JSON.parse(await readFile(new URL("docs/github-backlog-pilot.json", root), "utf8"));
  const labels = JSON.parse(await readFile(new URL(".github/labels.json", root), "utf8"));
  const allowed = new Set(labels.map(label => label.name));
  const ids = new Set();
  validateImportStatus(manifest);
  if (manifest.version !== 1
    || manifest.issues.length < 15 || manifest.issues.length > 25) throw new Error("Unexpected pilot scope");
  for (const issue of manifest.issues) {
    if (!/^RS-\d{3}$/.test(issue.id) || ids.has(issue.id)) throw new Error("Duplicate or invalid pilot ID");
    ids.add(issue.id);
    if (!issue.title || !issue.scope || !issue.acceptance?.length
      || !issue.labels?.length || issue.labels.some(label => !allowed.has(label))) throw new Error(`Incomplete ${issue.id}`);
    if (issue.labels.filter(label => label.startsWith("state:")).length !== 1) throw new Error(`Ambiguous state: ${issue.id}`);
    if (!/^docs\/[a-z0-9-]+\.md$/.test(issue.source) || !issue.evidence) throw new Error(`Invalid source: ${issue.id}`);
    const source = await readFile(new URL(issue.source, root), "utf8");
    if (!source.includes(issue.evidence)) throw new Error(`Source evidence moved: ${issue.id}`);
  }
  return manifest;
}

export function renderPilot(manifest) {
  const imported = manifest.status === "imported";
  return [imported ? "# Backlog pilot — imported source snapshot" : "# Backlog pilot — review only",
    imported ? `Imported ${manifest.importedOn} into ${manifest.repository}; see ${manifest.receipt}. GitHub Issues owns live task status. This command is read-only.`
      : "No issues, labels or projects have been created. Priorities and owners are deliberately unassigned.",
    ...manifest.issues.map(issue => [
      `## ${issue.id}: ${issue.title}`, issue.labels.join(" · "),
      `Source: ${issue.source} — ${issue.evidence}`, issue.scope,
      ...issue.acceptance.map(item => `- [ ] ${item}`),
      `Import marker: <!-- rawsignal-backlog:${issue.id} -->`,
    ].join("\n\n")),
  ].join("\n\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadPilot().then(manifest => console.log(renderPilot(manifest))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
