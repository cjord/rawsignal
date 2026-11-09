import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function gameTestDb(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync('drizzle').filter(n=>/^\d{4}.*\.sql$/.test(n)).sort())sqlite.exec(readFileSync('drizzle/'+name,'utf8'));
 const db={prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return this.execute()},execute(){return sqlite.prepare(sql).run(...args)}}},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 return {sqlite,db};
}
