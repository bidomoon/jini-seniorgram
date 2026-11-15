const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{randomUUID,randomBytes}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
const modules={};function load(file){file=path.resolve(file);if(modules[file])return modules[file];const exports={};modules[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n),Buffer,Request,Response,Headers,URL,URLSearchParams,AbortSignal,TextDecoder,TextEncoder,Blob,Uint8Array,Date,Error,Array,Set});return exports}
const {product}=load('server/product/handler.ts'),{googlePlayProvider}=load('server/billing/google.ts');
const {playBilling}=load('server/billing/handler.ts'),{playConfig,playHash,decryptPurchase,reconcilePlay}=load('server/billing/play.ts'),{hashToken}=load('server/commerce/security.ts');
(async()=>{
 const db=new PGlite();for(const file of fs.readdirSync('migrations/postgres').filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync('migrations/postgres/'+file,'utf8'));
 const ids=[randomUUID(),randomUUID()],sessions=['a'.repeat(43),'b'.repeat(43)];
 for(let i=0;i<2;i++){await db.query('INSERT INTO sg_accounts(id,kakao_id,nickname) VALUES($1,$2,$3)',[ids[i],String(i),'테스트 회원']);await db.query("INSERT INTO sg_sessions(hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[hashToken(sessions[i]),ids[i]])}
 const origin='https://jini-seniorgram.netlify.app',env={APP_ORIGIN:origin,DATABASE_URL:'local-test',PRODUCT_SCHEMA_VERSION:'3',KAKAO_PUBLIC_SIGNUP_ENABLED:'true',BILLING_SCHEMA_VERSION:'1',PLAY_BILLING_ENABLED:'true',PLAY_CREDENTIALS_READY:'true',PLAY_TOKEN_KEY:randomBytes(32).toString('base64'),PLAY_IMAGE_PRODUCT:'image-monthly',PLAY_VIDEO_PRODUCT:'video-monthly',PLAY_IMAGE_LIMIT:'10',PLAY_VIDEO_IMAGE_LIMIT:'10',PLAY_VIDEO_LIMIT:'2',PLAY_PUSH_AUDIENCE:origin+'/api/billing/play/notifications',PLAY_PUSH_EMAIL:'push@example.com'};
 const receipts=new Map();let reads=0,acks=0,ackFails=false,pushValid=true;
 const provider={get:async(pkg,token)=>{reads++;assert.equal(pkg,'app.jininova.seniorgram');const receipt=receipts.get(token);if(!receipt)throw Error('provider unavailable');return structuredClone(receipt)},acknowledge:async()=>{acks++;if(ackFails)throw Error('timeout')},verifyPush:async(jwt,audience,email)=>{assert.equal(audience,env.PLAY_PUSH_AUDIENCE);assert.equal(email,env.PLAY_PUSH_EMAIL);return pushValid}};
 const deps={env:k=>env[k],query:(q,v)=>db.query(q,v),transaction:fn=>db.transaction(tx=>fn((q,v)=>tx.query(q,v))),fetch:async()=>{throw Error('No live API calls allowed')},files:{}};
 function receipt(extra={}){return {subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',testPurchase:{},lineItems:[{productId:'image-monthly',expiryTime:new Date(Date.now()+86400000).toISOString(),latestSuccessfulOrderId:'GPA.1111-2222-3333',autoRenewingPlan:{autoRenewEnabled:true}}],...extra}}
 function call(endpoint,body,who=0,headers={}){return playBilling(new Request(origin+'/api/billing/play/'+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:origin,...(who>=0?{Cookie:'__Host-sg-session='+sessions[who]}:{}),...headers},body:body?JSON.stringify(body):undefined}),deps,provider)}
 async function verify(token,who=0){return call('verify',{purchaseToken:token,bindConsent:true},who)}
 async function remaining(who=0){return (await db.query('SELECT coalesce(sum(image_limit-image_used),0)::int n FROM sg_entitlements WHERE account_id=$1 AND revoked_at IS NULL AND ends_at>now()',[ids[who]])).rows[0].n}
 const token='purchase-token-one-1234';receipts.set(token,receipt());
 env.PLAY_BILLING_ENABLED='false';assert.equal((await verify(token)).status,503);assert.equal(reads,0);env.PLAY_BILLING_ENABLED='true';assert.equal((await call('config')).status,200);
 assert.equal((await verify(token,-1)).status,401);assert.equal((await call('verify',{purchaseToken:token,bindConsent:true},0,{Origin:'https://other.example'})).status,403);assert.equal((await call('verify',{purchaseToken:token})).status,400);
 assert.equal((await verify(token)).status,200);assert.equal(await remaining(),10);assert.equal(acks,1);
 let row=(await db.query('SELECT * FROM sg_play_purchases WHERE token_hash=$1',[playHash(token)])).rows[0];assert(!row.token_cipher.includes(token));assert.equal(decryptPurchase(row.token_cipher,k=>env[k]),token);
 await db.query('UPDATE sg_entitlements SET image_used=1 WHERE account_id=$1',[ids[0]]);assert.equal((await verify(token)).status,200);assert.equal(await remaining(),9,'restore does not reset used credit');
 const before=reads;assert.equal((await verify(token,1)).status,409);assert.equal(reads,before,'foreign account cannot even refresh another account purchase');assert.equal(await remaining(1),0);
 const renewal=receipt();renewal.lineItems[0].latestSuccessfulOrderId='GPA.1111-2222-3333..1';receipts.set(token,renewal);assert.equal((await verify(token)).status,200);assert.equal(await remaining(),10,'renewal grants one new period');await verify(token);assert.equal(await remaining(),10);
 await db.query('UPDATE sg_entitlements SET image_used=2 WHERE revoked_at IS NULL AND account_id=$1',[ids[0]]);
 renewal.subscriptionState='SUBSCRIPTION_STATE_IN_GRACE_PERIOD';renewal.lineItems[0].expiryTime=new Date(Date.now()+2*86400000).toISOString();receipts.set(token,renewal);await verify(token);assert.equal(await remaining(),8,'grace extension preserves consumption');
 renewal.subscriptionState='SUBSCRIPTION_STATE_ON_HOLD';receipts.set(token,renewal);await verify(token);assert.equal(await remaining(),0,'account hold revokes access');
 renewal.subscriptionState='SUBSCRIPTION_STATE_ACTIVE';receipts.set(token,renewal);await verify(token);assert.equal(await remaining(),8,'recovery restores same credit, not a fresh allowance');
 renewal.subscriptionState='SUBSCRIPTION_STATE_CANCELED';renewal.lineItems[0].autoRenewingPlan.autoRenewEnabled=false;receipts.set(token,renewal);await verify(token);assert.equal(await remaining(),8,'cancellation retains paid period');
 const bad='purchase-token-bad-1234';receipts.set(bad,receipt());ackFails=true;assert.equal((await verify(bad)).status,503);ackFails=false;assert.equal((await db.query('SELECT * FROM sg_play_purchases WHERE token_hash=$1',[playHash(bad)])).rows.length,0,'acknowledgement failure rolls back binding and allowance');assert.equal(await remaining(),8);
 const production='purchase-token-live-1234',live=receipt();delete live.testPurchase;receipts.set(production,live);assert.equal((await verify(production)).status,503,'live receipts stay blocked until live acceptance');
 const malformed=receipt();malformed.lineItems[0].expiryTime='invalid';receipts.set(token,malformed);assert.equal((await verify(token)).status,502);assert.equal(await remaining(),8,'malformed provider data cannot revoke known valid allowance');
 const unknown='purchase-token-other-1234',foreign=receipt();foreign.externalAccountIdentifiers={obfuscatedExternalAccountId:'other-account'};receipts.set(unknown,foreign);assert.equal((await verify(unknown)).status,409);
 const video='purchase-token-video-1234',replacement=receipt({linkedPurchaseToken:token});replacement.lineItems[0].productId='video-monthly';replacement.lineItems[0].latestSuccessfulOrderId='GPA.replacement-1234';receipts.set(video,replacement);assert.equal((await verify(video)).status,200);assert.equal(await remaining(),10);
 renewal.subscriptionState='SUBSCRIPTION_STATE_ACTIVE';receipts.set(token,renewal);await verify(token);assert.equal(await remaining(),10,'refreshing replaced token cannot revive old allowance');
 const stolen='purchase-token-stolen-1234';receipts.set(stolen,receipt({linkedPurchaseToken:video}));assert.equal((await verify(stolen,1)).status,409,'linked purchase cannot cross accounts');
 function push(token,type=12){return {message:{messageId:'event-1',data:Buffer.from(JSON.stringify({packageName:'app.jininova.seniorgram',subscriptionNotification:{purchaseToken:token,notificationType:type}})).toString('base64')}}}
 const auth={Authorization:'Bearer '+'x'.repeat(70)};pushValid=false;const readsBefore=reads;assert.equal((await call('notifications',push(video),-1,auth)).status,401);assert.equal(reads,readsBefore);pushValid=true;
 replacement.subscriptionState='SUBSCRIPTION_STATE_EXPIRED';receipts.set(video,replacement);assert.equal((await call('notifications',push(video),-1,auth)).status,200);assert.equal(await remaining(),0,'verified current expiry revokes allowance');await call('notifications',push(video,1),-1,auth);assert.equal(await remaining(),0,'stale notification cannot revive expired purchase');
 assert.equal((await call('notifications',push('purchase-unclaimed-1234'),-1,auth)).status,202,'unknown purchase waits for explicit client restore');

 // Signed notifications are signals, never grants; deleted accounts are ignored.
 assert.equal((await call('sync',{})).status,200,'member refresh executes valid SQL');
 const previous='purchase-unseen-predecessor-1234',next='purchase-newest-successor-1234';
 receipts.set(next,receipt({linkedPurchaseToken:previous}));await verify(next);
 receipts.set(previous,receipt());assert.equal((await verify(previous,1)).status,409,'unseen predecessor inherits owner binding');
 await verify(previous);assert.equal(await remaining(),10,'previous token cannot revive a second grant');
 let reconcileReads=reads;await reconcilePlay({...deps,query:()=>{throw Error('disabled sweep queried database')}},provider);assert.equal(reads,reconcileReads);
 env.PLAY_SYNC_ENABLED='true';await db.query("UPDATE sg_play_purchases SET checked_at=now()-interval '1 hour'");
 await reconcilePlay(deps,provider);assert(reads-reconcileReads<=2,'background sweep is bounded');
 const recurring=receipt();receipts.set(next,recurring);await verify(next);
 env.PLAY_BILLING_ENABLED='false'; // Delete-route tests use the already verified local ledger, never a live SDK.
 const deletion=()=>product(new Request(origin+'/api/account/delete',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'__Host-sg-session='+sessions[0]},body:JSON.stringify({confirmation:'탈퇴합니다'})}),deps);
 assert.equal((await deletion()).status,409,'auto-renewing Play grant blocks deletion with cancellation guidance');
 env.PLAY_BILLING_ENABLED='true';recurring.subscriptionState='SUBSCRIPTION_STATE_CANCELED';recurring.lineItems[0].autoRenewingPlan.autoRenewEnabled=false;receipts.set(next,recurring);await verify(next);
 env.PLAY_BILLING_ENABLED='false';assert.equal((await deletion()).status,200,'verified cancelled subscription permits erasure');
 assert.equal((await db.query("SELECT count(*)::int n FROM sg_play_purchases WHERE account_id=$1 AND token_cipher<>''",[ids[0]])).rows[0].n,0,'deletion erases purchase secrets');
 env.PLAY_BILLING_ENABLED='true';assert.equal((await call('notifications',push(next),-1,auth)).status,202,'deleted account notifications are safely ignored');
 const cold=googlePlayProvider({env:()=>undefined,fetch:()=>{throw Error('cold initialization made a live call')}});assert.equal(typeof cold.get,'function','disabled service initializes without credentials or network');
 env.PLAY_IMAGE_LIMIT='0';assert.equal(playConfig(k=>env[k]).ready,false,'missing sales allowance fails closed');
 await db.close();console.log('PASS Play billing: real PostgreSQL engine, no live Google calls. Auth/CSRF, encrypted token, owner binding, repeated restore, renewal, grace/hold/recovery/cancel/expiry, ack rollback, live gate, malformed response, linked replacement, signed-notification gate and stale-event recovery.');
})().catch(error=>{console.error(error);process.exitCode=1});
