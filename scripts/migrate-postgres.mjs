import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
if(process.env.MIGRATION_CONFIRM!=='seniorgram-dedicated-database')throw Error('Set MIGRATION_CONFIRM=seniorgram-dedicated-database only after confirming this is the dedicated Seniorgram database.');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required. Never pass credentials as command arguments.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
try{
 await client.connect();await client.query("SELECT pg_advisory_lock(73198620)");
 await client.query('CREATE TABLE IF NOT EXISTS sg_schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 const dir=new URL('../migrations/postgres/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
  if((await client.query('SELECT name FROM sg_schema_migrations WHERE name=$1',[file])).rowCount)continue;
  const sql=await readFile(new URL(file,dir),'utf8');await client.query('BEGIN');
  try{await client.query(sql.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));await client.query('INSERT INTO sg_schema_migrations(name) VALUES($1)',[file]);await client.query('COMMIT');console.log('Applied '+file)}catch(e){await client.query('ROLLBACK');throw e}
 }
 console.log('Migrations complete. Run node scripts/verify-postgres.mjs before configuring PRODUCT_SCHEMA_VERSION=3.');
}catch{console.error('Migration failed. Check the dedicated database connection and migration state; credentials are not printed.');process.exitCode=1}finally{await client.end()}
