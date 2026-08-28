import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {BENCHMARK_SERIES,parseAlphaVantageDaily,runBenchmarkIngestion} from "../db/benchmark-ingestion.ts";
import {readMetricSeries} from "../db/metrics-ingestion.ts";

class LocalStatement{
  constructor(statement){this.statement=statement;this.values=[]}
  bind(...values){this.values=values;return this}
  async run(){return this.statement.run(...this.values)}
  async first(){return this.statement.get(...this.values)??null}
  async all(){return{results:this.statement.all(...this.values)}}
}
class LocalD1{
  constructor(database){this.database=database}
  prepare(sql){return new LocalStatement(this.database.prepare(sql))}
}
async function migratedDatabase(){
  const database=new DatabaseSync(":memory:");database.exec("pragma foreign_keys=on");
  const directory=new URL("../drizzle/",import.meta.url),names=(await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  for(const name of names){const migration=await readFile(new URL(name,directory),"utf8");for(const statement of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))database.exec(statement)}
  return database;
}

const payload={"Meta Data":{},"Time Series (Daily)":{
  "2026-08-27":{"1. open":"640.0","4. close":"645.10"},
  "2026-08-26":{"1. open":"638.0","4. close":"641.00"},
  "bad-date":{"4. close":"1"},
  "2026-08-25":{"4. close":"not-a-number"},
}};

test("Alpha Vantage parsing keeps valid daily closes in date order and drops junk",()=>{
 assert.deepEqual(parseAlphaVantageDaily(payload),[
  {date:"2026-08-26",closeCents:64100},
  {date:"2026-08-27",closeCents:64510},
 ]);
 assert.deepEqual(parseAlphaVantageDaily({Note:"rate limited"}),[]);
});

test("the benchmark series upserts SPY closes and reports rate-limit bodies honestly",async()=>{
 const db=new LocalD1(await migratedDatabase());
 const ok=await runBenchmarkIngestion(db,"key",async()=>new Response(JSON.stringify(payload)));
 assert.deepEqual({rows:ok.rows,done:ok.done},{rows:2,done:true});
 const series=await readMetricSeries(db);
 assert.deepEqual(series[BENCHMARK_SERIES].map(point=>point.value),[641,645.1]);
 const limited=await runBenchmarkIngestion(db,"key",async()=>new Response(JSON.stringify({Note:"API call frequency"})));
 assert.deepEqual({rows:limited.rows,done:limited.done,note:limited.note},{rows:0,done:false,note:"API call frequency"});
});
