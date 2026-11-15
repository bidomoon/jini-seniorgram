const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),{randomUUID}=require('crypto'),{PGlite}=require('@electric-sql/pglite');
const cache={};function read(file){file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>n.startsWith('.')?read(path.resolve(path.dirname(file),n+'.ts')):require(n),Buffer,Date});return out}
const {cleanupPrivateData}=read('server/product/cleanup.ts');
(async()=>{
 const db=new PGlite();for(const file of fs.readdirSync('migrations/postgres').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('migrations/postgres/'+file,'utf8'));
 const env={},attempted=[];let queryCalls=0,fail=true;
 const d={env:k=>env[k],query:(q,v)=>{queryCalls++;return db.query(q,v)},files:{delete:async key=>{attempted.push(key);if(key==='members/retry.png'&&fail)throw Error('Simulated storage outage')}}};
 await cleanupPrivateData(d);assert.equal(queryCalls,0);assert.equal(attempted.length,0,'unconfigured DB performs no work');
 Object.assign(env,{DATABASE_URL:'local-test',PRODUCT_SCHEMA_VERSION:'3'});
 const id=randomUUID();await db.query('INSERT INTO sg_accounts(id,kakao_id) VALUES($1,$2)',[id,'test']);
 await db.query("INSERT INTO sg_sessions(hash,account_id,expires_at) VALUES('expired',$1,now()-interval '1 minute'),('valid',$1,now()+interval '1 day')",[id]);
 await db.query("INSERT INTO sg_oauth_states(hash,expires_at) VALUES('expired',now()-interval '1 minute'),('valid',now()+interval '10 minutes')");
 await db.query("INSERT INTO sg_file_deletions(object_key) VALUES('members/retry.png'),('members/done.png')");
 let result=await cleanupPrivateData(d);assert.equal(result.removedFiles,1);assert.equal(result.failedFiles,1);assert.equal(attempted.length,2,'one storage failure does not skip another file');
 assert.deepEqual((await db.query('SELECT object_key FROM sg_file_deletions')).rows,[{object_key:'members/retry.png'}],'failed deletion remains durable');
 assert.deepEqual((await db.query('SELECT hash FROM sg_sessions')).rows,[{hash:'valid'}]);assert.deepEqual((await db.query('SELECT hash FROM sg_oauth_states')).rows,[{hash:'valid'}]);
 assert.equal(env.JOB_SWEEPER_ENABLED,undefined);assert.equal(env.GENERATION_ENABLED,undefined);assert.equal(env.MEDIA_STORAGE_ENABLED,undefined,'privacy cleanup is independent from media creation gates');
 fail=false;result=await cleanupPrivateData(d);assert.equal(result.removedFiles,1);assert.equal(result.failedFiles,0);assert.equal((await db.query('SELECT * FROM sg_file_deletions')).rows.length,0);
 const after=attempted.length;await cleanupPrivateData(d);assert.equal(attempted.length,after,'successful deletion is not repeated');
 await db.query("INSERT INTO sg_file_deletions(object_key) SELECT 'members/batch-'||generate_series(1,12)");const before=attempted.length;await cleanupPrivateData(d);assert.equal(attempted.length-before,10,'bounded batch');assert.equal((await db.query('SELECT * FROM sg_file_deletions')).rows.length,2);
 await db.close();console.log('PASS privacy cleanup: runs with AI disabled, retries storage failures, preserves active sessions, removes expired auth state, bounded batch and unconfigured no-op. Local DB and fake storage only.');
})().catch(e=>{console.error(e);process.exitCode=1});
