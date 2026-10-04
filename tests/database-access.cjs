const fs=require('fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const file of ['001-accounts.sql','002-product.sql'])await db.exec(fs.readFileSync('migrations/postgres/'+file,'utf8'));
 await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;');
 await db.exec("CREATE TABLE unrelated_example(id int); GRANT SELECT ON unrelated_example TO anon;");
 const sql=fs.readFileSync('migrations/postgres/20261004113802_private_member_tables.sql','utf8');
 await db.exec(sql);await db.exec(sql);
 const tables=(await db.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND left(c.relname,3)='sg_'" )).rows;
 assert(tables.length>=10);
 for(const table of tables){
  assert.equal(table.relrowsecurity,true);
  for(const role of ['anon','authenticated'])for(const op of ['SELECT','INSERT','UPDATE','DELETE']){
   const result=await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,'public.'+table.relname,op]);
   assert.equal(result.rows[0].allowed,false,role+' '+op+' '+table.relname);
  }
 }
 assert.equal((await db.query("SELECT has_table_privilege('anon','public.unrelated_example','SELECT') AS allowed")).rows[0].allowed,true,'does not change unrelated tables');
 await db.query("INSERT INTO sg_accounts(id,kakao_id) VALUES('11111111-1111-4111-8111-111111111111','test')");
 for(const role of ['anon','authenticated']){
  await db.exec('SET ROLE '+role);
  await assert.rejects(db.query('SELECT * FROM sg_accounts'),/permission denied/);
  await db.exec('RESET ROLE');
 }
 // Even an accidental future read grant must not expose member rows.
 await db.exec('GRANT SELECT ON sg_accounts TO anon; SET ROLE anon;');
 assert.equal((await db.query('SELECT * FROM sg_accounts')).rows.length,0);
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT * FROM sg_accounts')).rows.length,1,'server owner retains access');
 await db.close();console.log('PASS database access: all private tables deny public/client roles, RLS defense, owner works and unrelated tables preserved. Local PostgreSQL engine only.');
})().catch(e=>{console.error(e);process.exitCode=1});
