const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
const cache={};function read(file){file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>n.startsWith('.')?read(path.resolve(path.dirname(file),n+'.ts')):require(n),Buffer,Request,Response,Headers,URL,URLSearchParams,AbortSignal,TextDecoder,TextEncoder,Blob,Uint8Array,Date,Error});return out}
const {commerce}=read('server/commerce/handler.ts'),{product}=read('server/product/handler.ts');
(async()=>{
 const db=new PGlite();for(const file of fs.readdirSync('migrations/postgres').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('migrations/postgres/'+file,'utf8'));
 const origin='https://jini-seniorgram.netlify.app',env={APP_ORIGIN:origin,DATABASE_URL:'local-test',PRODUCT_SCHEMA_VERSION:'3',KAKAO_LOGIN_ENABLED:'true',KAKAO_REST_API_KEY:'fake-key',KAKAO_CLIENT_SECRET:'fake-secret'};
 let kakaoId=12345,providerCalls=0;
 const d={env:k=>env[k],query:(q,v)=>db.query(q,v),transaction:fn=>db.transaction(tx=>fn((q,v)=>tx.query(q,v))),files:{},fetch:async url=>{providerCalls++;if(url.endsWith('/oauth/token'))return Response.json({access_token:'not-a-real-token'});if(url.endsWith('/v2/user/me'))return Response.json({id:kakaoId,properties:{nickname:'초대 회원'}});throw Error('Unexpected provider call')}};
 const req=(route,cookie)=>new Request(origin+route,{headers:cookie?{cookie}:{}});
 const config=async()=> (await commerce(req('/api/account/config'),d)).json();
 for(const list of [undefined,'','12345,','12345,invalid','0','9007199254740992',Array(101).fill('12345').join(',')]){
  if(list===undefined)delete env.KAKAO_BETA_USER_IDS;else env.KAKAO_BETA_USER_IDS=list;
  assert.equal((await config()).loginReady,false,'missing or malformed admission list stays closed');
  assert.equal((await commerce(req('/api/auth/kakao/start'),d)).status,503);
 }
 assert.equal(providerCalls,0);assert.equal((await db.query('SELECT * FROM sg_accounts')).rows.length,0);
 env.KAKAO_BETA_USER_IDS='12345, 67890';
 let conf=await config();assert.equal(conf.loginReady,true);assert.equal(conf.loginMode,'beta');assert(!JSON.stringify(conf).includes('12345'),'configuration does not disclose the private invitation list');
 async function login(){const start=await commerce(req('/api/auth/kakao/start'),d);assert.equal(start.status,303);const state=new URL(start.headers.get('location')).searchParams.get('state');return commerce(req('/api/auth/kakao/callback?state='+state+'&code=fake','__Host-sg-oauth='+state),d)}
 kakaoId=55555;let r=await login();assert.equal(r.headers.get('location'),origin+'/?account=login-invitation-only');assert(!r.headers.get('set-cookie').includes('__Host-sg-session='));assert.equal((await db.query('SELECT * FROM sg_accounts')).rows.length,0,'uninvited identities never create members');
 kakaoId=12345;r=await login();assert.equal(r.headers.get('location'),origin+'/?account=welcome');const session=r.headers.get('set-cookie').match(/__Host-sg-session=[A-Za-z0-9_-]+/)[0];
 let me=await (await commerce(req('/api/account/me',session),d)).json();assert(me.user.id);assert(!JSON.stringify(me).includes('12345'),'Kakao identity is not returned in member responses');
 assert.equal((await product(req('/api/account/usage',session),d)).status,200);
 env.KAKAO_BETA_USER_IDS='67890';assert.equal((await (await commerce(req('/api/account/me',session),d)).json()).user,null,'removing an invitation immediately disables an existing session');assert.equal((await product(req('/api/account/usage',session),d)).status,401);
 delete env.KAKAO_BETA_USER_IDS;assert.equal((await config()).loginMode,'closed');assert.equal((await product(req('/api/account/usage',session),d)).status,401);
 env.KAKAO_PUBLIC_SIGNUP_ENABLED='true';assert.equal((await config()).loginMode,'public');kakaoId=55555;r=await login();assert.equal(r.headers.get('location'),origin+'/?account=welcome');
 await db.close();console.log('PASS login admission: default closed, strict private invitations, no unauthorized registration, session restriction, no identity leak, explicit public rollout. Local DB and fake Kakao responses only.');
})().catch(e=>{console.error(e);process.exitCode=1});
