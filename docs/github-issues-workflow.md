# GitHub task tracking — implementation and activation

## Current checkpoint

**Pilot imported and verified on 2026-10-23:** all 21 approved items are now public
issues in `cjord/rawsignal` (12 triage, 9 deferred), with unique markers and verified
scope/criteria/labels. The user explicitly approved public issues, superseding the
earlier private plan. See the [import receipt](github-backlog-import-2026-10-23.md).
GitHub Issues now owns status for these migrated tasks. Authority remains with TODO
documents only for unmigrated proposals awaiting their own review/import.

No Project or recurring job is active. Repository visibility/access were not changed;
no code was pushed or deployed. GitHub created requested issue labels with default
colors; custom styling is still local. The digest remains disabled and private-only
until a separately reviewed public-repository adjustment; it must not be activated
as-is against this public repository. The remaining checklist below is a historical
private-first setup plan, not permission to change settings or import again.

The first pilot is **21 imported issues: 12 triage, 9 explicitly deferred**.
The [pilot review](github-backlog-review.md) is retained as approval history.
The machine-readable [manifest](github-backlog-pilot.json) contains scope, exclusions,
source evidence and completion criteria at import time. It is not a live backlog.

## What is implemented locally

- Four issue forms: Bug, Improvement, Investigation/Decision and Maintenance/Review.
  Blank issues are disabled; this is convenience, not an access control.
- A small label vocabulary for type, area and workflow state; no invented priorities,
  assignees or due dates on imported work.
- A PR checklist covering scope, evidence, privacy and the full release gate.
- Existing Quality workflow retained, with read-only permissions, fixed action
  revisions, no persisted checkout credentials, a 30-minute limit, manual execution
  and cancellation of superseded runs. Its existing `test` job identity is preserved.
- A weekly task digest: **Monday 9 AM America/New_York**, following daylight saving.
  Scheduled publication is disabled unless `RAW_SIGNAL_WEEKLY_DIGEST_ENABLED=true`.
  Manual runs preview by default; the Actions summary contains the proposed issue.
- A non-mutating pilot validator/preview: `node scripts/github/backlog-preview.mjs`.
  It checks IDs, scope size, known labels, one state and exact source evidence.

No dependency, app page, catalog feed, database, deployment workflow or Cloudflare
schedule is changed. No AI service or paid API is required by these workflows.

## Authority and day-to-day use

Until the approved pilot is imported and verified, update TODO documents as before.
After the explicit transition checkpoint, issue state/labels/assignee own status,
priority and ownership. Documents keep requirements, design decisions and release
evidence; link issues rather than maintaining parallel checkbox lists. Do not migrate
shipped historical entries merely because an old document still calls them open.

Use exactly one `state:` label on each open task: triage, ready, active, blocked or
deferred. Closing the issue records completion (or use GitHub's not-planned reason).
Type/area labels explain what and where. Deferred means parked, not overdue; no
reminders or deadlines are inferred. Promote triage to ready only after scope,
acceptance and permission boundaries are clear. Any priorities added later must be
reviewed rather than guessed by the importer. Available priority labels are critical
(urgent security/data loss/outage), high (next priority), normal (planned) and low
(optional refinement). Use at most one; unset means not yet ranked. Low is not a
substitute for explicitly deferred. Assignees stay empty until work is accepted.

The initial private Project should be named **Raw Signal — Work Tracker**, with a
table showing issue title, labels, assignee and linked PRs. Saved views: Triage,
Ready/Active, Blocked, Deferred and Recently Closed. Use issue labels as the status
source; do not introduce a competing manually maintained Project Status field.
A visual board can follow once a single-way mapping is chosen. Keep the Project
private and its membership limited to the maintainer. Private project visibility
does not make issues in a public repository private.

## Original live setup checklist — import completed; other steps not activated

1. Confirm authenticated GitHub access, repository identity, private visibility,
   Issues enabled and default branch. Never copy tokens into chat or extract stored
   git credentials. Git push access does not prove Issues/Projects API permission.
2. Review the 21 drafts below, remove stale proposals and approve exact scope.
   Re-read source and current code at import time; the manifest is only a dated
   candidate list. Do not import untracked article drafts or unrelated local edits.
3. When explicitly asked, push the validated setup branch and merge it through a PR.
   This task has not authorized a push or a site deployment.
4. Create missing labels without deleting or overwriting unrelated existing labels.
   Create the private Project and saved views using native GitHub controls; do not
   add a broad personal token to Actions just to manage Projects.
5. Import approved issues serially, with `<!-- rawsignal-backlog:RS-NNN -->` markers.
   Before every create, check open **and closed** issues for that marker. Record
   returned issue URLs. A failed/ambiguous write requires inspection, never blind
   retries. No bulk-write importer is shipped before this review/access checkpoint.
6. Verify count, titles, state labels, full acceptance text, source links and Project
   membership. Record a source-key → issue-URL migration receipt in this document.
   Human review is required: source-text presence alone does not prove a task open.
7. Only now record the authority transition date and update TODO status references.
   Do not delete original design or completed-history documents.
8. On the default branch, run the digest manually with **publish=false**. Inspect
   its Actions summary. Then publish one test digest for the current week; rerun and
   confirm it skips the same issue. Ensure `type:digest` exists first.
9. Only after verification, set `RAW_SIGNAL_WEEKLY_DIGEST_ENABLED=true`. Confirm the
   next Monday run and GitHub notification subscriptions. Email delivery depends on
   the user's GitHub settings, not just issue creation. Unset the variable to pause.

If import is interrupted, leave authority with documents until reconciliation.
Keep partially imported issues with their markers and resume by checking the receipt;
do not delete/recreate them or lose comments. Archive/close an accidentally imported
draft with a reason, rather than deleting history.

## Digest boundaries and safeguards

The first version summarizes completed tasks from the preceding seven days plus
active, ready, blocked and triage issues. It excludes pull requests, prior digests
and deferred work. It uses titles, labels and links, not issue-body contents or
account data in the summary. Closed task timing is based on `closed_at`, so a
close/reopen/close is not a full activity ledger. Unlabeled tasks should be triaged
before activation; the pilot/form defaults supply that label.

The Monday key is calculated in Eastern time, including across DST. A manual run
later in the week uses that week's Monday key. Duplicate markers cause a safe stop;
an existing single digest is left untouched, preserving human comments/edits.
Actions concurrency serializes digest runs. Reads paginate up to 2,000 records
(including PRs), then fail rather than publish incomplete data. At most 60 entries
per section are displayed, with an explicit overflow note; an oversized final body
stops before publication. No automatic retry is
performed on writes. If a request times out after creation, inspect before rerunning;
the next run checks the marker. Other out-of-band writers must not create digests.

Publishing requires an Actions run on the repository's default branch and a
private repository. The preview job has read-only permissions; only the separate
default-branch publishing job has `issues:write`. Neither has deployment secrets.
Preview summaries remain private repository Actions data; never make the
repository public without reviewing task content and disabling this workflow.
No raw API response, credential, export, trace or database backup is uploaded.
No CI-failure enumeration, due-date parsing, AI prioritization, stale-issue closure,
article scheduling or application data freshness checks are claimed in this version.

## GitHub Free limitations and costs

This setup deliberately avoids paid approval features. On GitHub Free, private
repository protected-branch requirements are not generally available; a PR checklist
is a convention, **not enforced separation of duties**. A sole maintainer also cannot
provide an independent self-approval. Keep production release approval explicit in
the existing local workflow. Do not describe this configuration as a production gate.

Private-repository Actions consume the account's included minutes/storage. One
Linux Quality job, npm caching and cancellation limit waste; the digest installs no
packages and should be short. No failure artifacts are uploaded until their privacy
and retention policy is reviewed. Scheduled jobs may be delayed or dropped by GitHub;
this is a useful weekly digest, not a guaranteed alarm or exact-time service.

Official references checked 2026-10-22:

- [Timezone-aware schedules and delivery caveats](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub plans and private repository Actions](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- [Protected branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Native Project auto-add](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically)

## Deferred automation options

Prefer native Project auto-add once filters and access are verified; exclude
`type:digest`. No status-changing or closing bot initially. Later candidates are
sanitized failure artifacts, dependency-update grouping, a separate review-only
editorial job and explicit deployment workflows with proven rollback and access
boundaries. None are activated by approving the weekly task digest.

## Migration receipt

Completed for issues #1–#21; the [full receipt](github-backlog-import-2026-10-23.md)
records every source key and URL. No Project URL exists yet. Follow GitHub Issues for
current status of migrated tasks; do not maintain duplicate TODO checkboxes.
