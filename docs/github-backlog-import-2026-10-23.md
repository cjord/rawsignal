# Backlog import receipt — 2026-10-23

## Verified outcome

The maintainer approved importing all 21 summarized items and then explicitly
approved leaving `cjord/rawsignal` public and creating the issues publicly. That
supersedes the earlier private-repository requirement for this import. Repository
visibility was not changed. Connected-account repository access and Issues were
verified before creation; all-state issue enumeration initially returned no issues.

All 21 issues were created serially, checking open and closed issues before each
write. A final API read verified unique import markers, exact titles, full scope
and acceptance criteria, open state, the expected labels, no assignees and no
milestones. Result: **12 triage issues and 9 deferred issues**. No due dates or
reminders were added. Deferred work remains parked until explicitly reprioritized.

Public issue bodies contain reviewed requirements and safe source references, not
credentials, account records, private exports, database identifiers or unpublished
article drafts. Source notes not yet pushed are identified as local; affected issues
are self-contained rather than linking to nonexistent remote documents. GitHub
created the requested labels with default colors; custom label colors/descriptions
from the local label manifest have not been configured remotely.

## Source-key to issue mapping

| Key | Issue | State at import |
|---|---|---|
| RS-001 | [#1 — Cold-refresh market/account bootstrap](https://github.com/cjord/rawsignal/issues/1) | Triage |
| RS-002 | [#2 — Catalog availability during ingestion](https://github.com/cjord/rawsignal/issues/2) | Triage |
| RS-003 | [#3 — Human production account acceptance](https://github.com/cjord/rawsignal/issues/3) | Triage |
| RS-004 | [#4 — Compact auction catalog rollout](https://github.com/cjord/rawsignal/issues/4) | Triage |
| RS-005 | [#5 — New Pokémon rarity mappings](https://github.com/cjord/rawsignal/issues/5) | Triage |
| RS-006 | [#6 — Radiance presale policy](https://github.com/cjord/rawsignal/issues/6) | Triage |
| RS-007 | [#7 — Retailer-exclusive sealed classification](https://github.com/cjord/rawsignal/issues/7) | Triage |
| RS-008 | [#8 — Sales corrections/refunds](https://github.com/cjord/rawsignal/issues/8) | Deferred |
| RS-009 | [#9 — Collection transfers](https://github.com/cjord/rawsignal/issues/9) | Deferred |
| RS-010 | [#10 — Bulk sticker-price edits](https://github.com/cjord/rawsignal/issues/10) | Deferred |
| RS-011 | [#11 — Collection archiving](https://github.com/cjord/rawsignal/issues/11) | Deferred |
| RS-012 | [#12 — Privacy/backup retention](https://github.com/cjord/rawsignal/issues/12) | Triage |
| RS-013 | [#13 — Deletion-outbox monitoring](https://github.com/cjord/rawsignal/issues/13) | Triage |
| RS-014 | [#14 — October model review](https://github.com/cjord/rawsignal/issues/14) | Triage |
| RS-015 | [#15 — Model-version history](https://github.com/cjord/rawsignal/issues/15) | Triage |
| RS-016 | [#16 — Editorial Queue scope](https://github.com/cjord/rawsignal/issues/16) | Triage |
| RS-017 | [#17 — Optional Module Budget](https://github.com/cjord/rawsignal/issues/17) | Deferred |
| RS-018 | [#18 — Physical Recovery Testing](https://github.com/cjord/rawsignal/issues/18) | Deferred |
| RS-019 | [#19 — Populated Account Acceptance](https://github.com/cjord/rawsignal/issues/19) | Deferred |
| RS-020 | [#20 — Public-only auction multiplayer](https://github.com/cjord/rawsignal/issues/20) | Deferred |
| RS-021 | [#21 — Staging-only developer mode](https://github.com/cjord/rawsignal/issues/21) | Deferred |

## Authority transition and remaining setup

The approved pilot import/verification gate is satisfied. GitHub Issues now owns
status, priority and assignment for these migrated items; the JSON manifest and
table above are immutable import evidence, not a second live backlog. Repository
documents retain specifications and history. Unmigrated TODO proposals remain an
intake queue pending separate review, not automatically approved issues.

No GitHub Project, recurring digest, repository access setting, branch protection,
code push, merge, site deployment or database change was performed. The local
weekly digest remains disabled and still enforces its original private-repository
guard. Public-repository digest support needs a deliberate privacy review and
change before activation; public issue approval does not silently enable it.

The local issue forms, label styling, PR template and workflow changes still need
an explicitly requested code push before they become available on GitHub. Preserve
unrelated existing TODO edits and untracked article/image material when staging them.
