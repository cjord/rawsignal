import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { emptyHistory } from "../../../core/domain/history-snapshot.ts";
import { historyBatchKey } from "../../../core/history-batch.ts";
import { readHistorySnapshots } from "../../../db/history-snapshot.ts";
import type { D1DatabaseLike } from "../../../db/repository.ts";
import { CACHE_TIERS } from "../cache.ts";
import { readSalesSummary } from "../../../db/sales-summary.ts";
import { SALES_SUMMARIES_ENABLED } from "../../../core/domain/sales-summary.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") ?? "";
  const printing = url.searchParams.get("printing") ?? "";
  const sealed = url.searchParams.get("sealed") === "1";
  const snapshotId = url.searchParams.get("snapshot") ?? undefined;
  if (!/^\d{1,9}$/.test(productId) || (snapshotId && !/^[a-zA-Z0-9_-]{1,100}$/.test(snapshotId))) return NextResponse.json({ error: "Invalid history request" }, { status: 400 });
  const target = { productId: Number(productId), printing, sealed, snapshotId };
  const db=env.DB as unknown as D1DatabaseLike|undefined;
  if(db)try{const stored=(await readHistorySnapshots(db,[target])).get(historyBatchKey(target));if(stored){
    const salesSummary=SALES_SUMMARIES_ENABLED&&url.searchParams.get("sales")==="1"?await readSalesSummary(db,Number(productId),stored.variant!,stored.condition!).catch(()=>undefined):undefined;
    return NextResponse.json({...stored,salesSummary},{headers:{"Cache-Control":CACHE_TIERS.hour}});
  }}catch{/* Deploy-before-migrate and missing snapshots stay unavailable. */}
  return NextResponse.json(emptyHistory,{headers:{"Cache-Control":CACHE_TIERS.transient}});
}
