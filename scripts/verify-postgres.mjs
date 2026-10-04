import pg from 'pg';
import {readdir} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required as a private environment variable.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,query_timeout:10000});
try{
 await client.connect();
 const expected=(await readdir(new URL('../migrations/postgres/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
 const applied=(await client.query('SELECT name FROM sg_schema_migrations')).rows.map(row=>row.name);
 const migrationsReady=expected.every(name=>applied.includes(name));
 const privateTables=(await client.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND left(c.relname,3)='sg_'" )).rows;
 const roles=(await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows;
 let clientAccessBlocked=true;
 for(const table of privateTables)for(const role of roles)for(const op of ['SELECT','INSERT','UPDATE','DELETE']){
  if((await client.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role.rolname,'public.'+table.relname,op])).rows[0].allowed)clientAccessBlocked=false;
 }
 // Check required relations/columns without reading any member records.
 await client.query('SELECT a.deleted_at,e.image_used,e.video_used FROM sg_accounts a LEFT JOIN sg_entitlements e ON a.id=e.account_id LIMIT 0');
 const checks={migrationsReady,privateTablesProtected:privateTables.length>=10&&privateTables.every(t=>t.relrowsecurity),clientAccessBlocked,requiredColumnsPresent:true};
 const ready=Object.values(checks).every(Boolean);
 console.log(JSON.stringify({ready,checks,missingMigrations:expected.filter(n=>!applied.includes(n)),next:ready?'Set PRODUCT_SCHEMA_VERSION=3. Authentication and generation remain separate.':'Resolve failed checks before enabling members.'},null,2));
 if(!ready)process.exitCode=1;
}catch{console.error('Database verification failed. No credentials or member records were printed.');process.exitCode=1;}finally{await client.end();}
