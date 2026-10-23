export const TIME_ZONE = "America/New_York";

export function weekKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  const civil = new Date(`${value("year")}-${value("month")}-${value("day")}T12:00:00Z`);
  civil.setUTCDate(civil.getUTCDate() - (civil.getUTCDay() + 6) % 7);
  return civil.toISOString().slice(0, 10);
}

export const digestMarker = key => `<!-- rawsignal-weekly-digest:${key} -->`;
const hasLabel = (issue, name) => issue.labels?.some(label => (typeof label === "string" ? label : label.name) === name);
const safeTitle = title => String(title).slice(0, 200)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("@", "&#64;").replace(/[\r\n]/g, " ").replace(/([\\`*_[\]])/g, "\\$1");

export function buildDigest(issues, repository, now = new Date()) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid repository name");
  const key = weekKey(now);
  const cutoff = now.getTime() - 7 * 86400000;
  const tasks = issues.filter(issue => !issue.pull_request && !hasLabel(issue, "type:digest")
    && !issue.body?.includes("<!-- rawsignal-weekly-digest:") && !hasLabel(issue, "state:deferred"));
  const open = tasks.filter(issue => issue.state === "open");
  const sections = [
    ["Completed in the past seven days", tasks.filter(issue => issue.state === "closed"
      && Date.parse(issue.closed_at) >= cutoff && Date.parse(issue.closed_at) <= now.getTime())],
    ["Active", open.filter(issue => hasLabel(issue, "state:active"))],
    ["Ready", open.filter(issue => hasLabel(issue, "state:ready"))],
    ["Blocked — decisions or dependencies", open.filter(issue => hasLabel(issue, "state:blocked"))],
    ["Needs triage", open.filter(issue => hasLabel(issue, "state:triage"))],
  ];
  const body = [digestMarker(key), `# Task digest — week of ${key}`,
    `Generated ${now.toISOString()}. Week labels use ${TIME_ZONE}; completions cover the preceding seven days.`,
    "Deferred work and prior digests are excluded. This is a snapshot, not a second task-status system.",
    ...sections.flatMap(([heading, entries]) => [
      `## ${heading} (${entries.length})`,
      entries.length ? entries.slice(0, 60).map(issue => `- [#${issue.number}](https://github.com/${repository}/issues/${issue.number}) ${safeTitle(issue.title)}`).join("\n") : "None.",
      ...(entries.length > 60 ? ["Showing the first 60; consult the issue list for the remainder."] : []),
    ]),
    "No deployment, ingestion, article publication or task reprioritization is performed by this digest.",
  ].join("\n\n");
  if (body.length > 60000) throw new Error("Digest exceeds safe issue size; narrow its scope before publishing");
  return {key, title: `Weekly task digest — ${key}`, body, labels: ["type:digest"]};
}
