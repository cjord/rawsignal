import type { D1DatabaseLike } from "./repository.ts";

// Guard-cron tick lease (todo R4, 2026-09-05). Cron triggers fire every minute whether or not
// the previous tick finished; a live tick (80 records × ~12 D1 operations) sits right at that
// period, so under D1 latency a trailing tick started while the leader was mid-slice, read the
// same cursor, found every record already stamped, and checkpointed the leader's stale stats —
// halving throughput and, at the end of the walk, tripping the minimum-records guard on an
// undercounted total. One row in `refresh_state` (`cron-lease`, `cursor` = lease expiry) is
// claimed with a single conditional upsert; a tick that cannot claim it exits idle. The lease
// outlives any sane tick, so a crashed tick blocks at most a couple of minutes.

export const TICK_LEASE_KEY = "cron-lease";
export const TICK_LEASE_MS = 170_000;

type RunResult = { meta?: { changes?: number }; changes?: number } | undefined;

export async function claimTickLease(db: D1DatabaseLike, now: Date, ttlMs = TICK_LEASE_MS): Promise<boolean> {
  const nowIso = now.toISOString(), until = new Date(now.getTime() + ttlMs).toISOString();
  const result = (await db.prepare(`insert into refresh_state (key, cursor) values (?, ?)
    on conflict(key) do update set cursor = excluded.cursor where refresh_state.cursor is null or refresh_state.cursor < ?`)
    .bind(TICK_LEASE_KEY, until, nowIso).run()) as RunResult;
  const changes = result?.meta?.changes ?? result?.changes;
  // A driver that reports no change count cannot tell us the claim failed; treat it as held.
  return changes == null ? true : changes > 0;
}

export async function releaseTickLease(db: D1DatabaseLike): Promise<void> {
  await db.prepare("update refresh_state set cursor = null where key = ?").bind(TICK_LEASE_KEY).run();
}
