# Backlog pilot — maintainer review

**Imported and verified on 2026-10-23:** all 21 items are now public GitHub issues
[#1–#21](https://github.com/cjord/rawsignal/issues). The user explicitly approved
keeping the repository and issues public, superseding the original private plan.
See the [per-item import receipt](github-backlog-import-2026-10-23.md).

This is the reviewed import snapshot, not a new priority order or live status list.
Each has source evidence, exclusions and completion criteria in the
[manifest](github-backlog-pilot.json). Preview full proposed text with
`node scripts/github/backlog-preview.mjs` (read-only, no GitHub credentials required).

## Needs triage — 12

| Key | Proposed issue | Why it needs review |
|---|---|---|
| RS-001 | Intermittent cold-refresh market/account bootstrap | Cause and reported login state unconfirmed; evidence before fixes. |
| RS-002 | Catalog availability during ingestion | Reproduce run publication boundaries; no live repair authorized. |
| RS-003 | Human production account acceptance | Preview/API checks are not custom-domain sign-in acceptance. |
| RS-004 | Compact auction catalog production rollout | Reconcile superseded flag notes and latest staging parity first. |
| RS-005 | New Pokémon rarity mappings | Explicit taxonomy/heatmap decision; no guessed pull rates. |
| RS-006 | Radiance bundled/live presale alignment | Decide eligibility before authorizing regenerated feeds. |
| RS-007 | Retailer-exclusive sealed classification | Consolidate duplicate L4/M13 proposals into one audit. |
| RS-012 | Privacy and backup retention | Policy decision before destructive cleanup. |
| RS-013 | Deletion-outbox monitoring | Synthetic operational acceptance, not real account deletion. |
| RS-014 | October model-review reconciliation | Verify whether completed; do not assume an old date means overdue. |
| RS-015 | Model-version history stamping | Inspect schema/writers before a migration; no automatic promotion. |
| RS-016 | Editorial Queue first-release scope | Human-reviewed drafts only; local draft files remain unpublished. |

## Deferred — 9

| Key | Proposed issue | Resume boundary |
|---|---|---|
| RS-008 | Append-only sales corrections/refunds | Reprioritize; preserve original allocations and stock conservation. |
| RS-009 | Collection transfers | Reprioritize; preserve dated baselines and provenance. |
| RS-010 | Bulk sticker-price edits | Reprioritize; preview and atomic revision checks first. |
| RS-011 | Collection archiving | Reprioritize; preserve history rather than delete. |
| RS-017 | Optional Module Budget | Explicitly deferred; measurable benefit required. |
| RS-018 | Physical Recovery Testing | Explicitly deferred; hardware and real-device acceptance needed. |
| RS-019 | Populated Account Acceptance | Explicitly deferred; disposable fixtures only. |
| RS-020 | Public-only auction multiplayer | Future discovery; no private codes or infrastructure provisioning. |
| RS-021 | Staging-only developer mode | Future discovery; default-off authorization and production exclusion. |

No deferred reminders or invented due dates will be added. Priority and assignee
remain unset until reviewed. Approval of this list permits the next import step,
not implementation of every proposed feature, ingestion, model promotion or deploy.

Original review questions (approval is now recorded in the receipt):

1. Keep, remove or rename any of these candidates before importing?
2. Which two or three triage items should be reviewed first? No urgency is assumed.
3. Confirm GitHub access and the private Project name **Raw Signal — Work Tracker**.

See the [activation runbook](github-issues-workflow.md) for access, import receipts,
authority transition, digest verification and GitHub Free limitations.
