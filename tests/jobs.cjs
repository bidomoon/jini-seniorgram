const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const files=new Map();let storageFails=false;
const env={GENERATION_ENABLED:'true',GENERATION_DAILY_LIMIT:'100',OPENAI_API_KEY:'test-openai',DB:{prepare(q){let a=[];const st=sql.prepare(q);return {bind(...v){a=v;return this},async first(){return st.get(...a)||null},async all(){return {results:st.all(...a)}},async run(){return st.run(...a)}}}},BUCKET:{async put(k,v){if(storageFails)throw Error('storage offline');files.set(k,new Uint8Array(v))},async get(k,o){const value=files.get(k);if(!value)return null;const match=o?.range?.get('range')?.match(/^bytes=(\d+)-(\d+)$/);const offset=match?+match[1]:0,length=match?+match[2]-offset+1:value.length;return {body:value.slice(offset,offset+length),size:value.length,...(match?{range:{offset,length}}:{})}}}};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=';
let createCalls=0,pollCalls=0,mode='pending',lastCreate=null,unsafeVideo=false,externalCalls=0,moderationInvalid=false,videoRedirect=false,storageHadKey=false;
const jobs={},route={};const context={exports:jobs,require:n=>n==='cloudflare:workers'?{env}:n==='../jobs'?jobs:require(n),Response,Request,Headers,URL,TextDecoder,Uint8Array,atob,crypto,AbortSignal,fetch:async(input,options={})=>{const u=String(input);
 if(u.endsWith('/moderations'))return Response.json({results:moderationInvalid?[]:[{flagged:false}]});
 if(u==='https://api.openai.com/v1/responses'){createCalls++;lastCreate=JSON.parse(options.body);if(mode==='submission-timeout')throw Error('timeout');return Response.json({id:'resp_'+createCalls,status:'queued'})}
 if(u.startsWith('https://api.openai.com/v1/responses/')){pollCalls++;if(mode==='expired')return new Response('',{status:404});if(mode==='provider-failure')return new Response('',{status:503});return Response.json(mode==='done'?{status:'completed',output:[{type:'image_generation_call',result:png}]}:{status:'in_progress'})}
 if(u.endsWith(':predictLongRunning')){createCalls++;lastCreate=JSON.parse(options.body);return Response.json({name:'models/veo-3.1-fast-generate-preview/operations/test-video'})}
 if(u.includes('/operations/')){pollCalls++;return Response.json(mode==='done'?{done:true,response:{generateVideoResponse:{generatedSamples:[{video:{uri:unsafeVideo?'https://attacker.example/private':'https://generativelanguage.googleapis.com/download/test.mp4'}}]}}}:{done:false})}
 if(u.startsWith('https://generativelanguage.googleapis.com/download/')){if(videoRedirect)return new Response(null,{status:302,headers:{location:'https://storage.googleapis.com/provider/video.mp4'}});return new Response(new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109]))}
 if(u.startsWith('https://storage.googleapis.com/')){storageHadKey=!!options.headers?.['x-goog-api-key'];return new Response(new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109]))}
 externalCalls++;throw Error('unexpected outbound URL');
}};
const load=(file,exports)=>vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...context,exports});load('app/api/sg/jobs.ts',jobs);load('app/api/sg/[...path]/route.ts',route);
const req=(p,b,user='alice',origin='https://example.test')=>new Request('https://example.test/api/sg/'+p,{method:b?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),'content-type':'application/json',origin},...(b?{body:JSON.stringify(b)}:{})});
const post=async(p,b,user='alice')=>{const r=await route.POST(req(p,b,user));return {status:r.status,...await r.json()}};
const get=async(p,user='alice')=>{const r=await route.GET(req(p,null,user));return {status:r.status,...await r.json()}};
const start=(extra={},user='alice')=>post('jobs',{requestId:crypto.randomUUID(),kind:'image',prompt:'꽃밭의 강아지',...extra},user);
const poll=async(j)=>{sql.prepare('UPDATE generation_jobs SET checked=0 WHERE id=?').run(j.id);return post('jobs/'+j.id+'/refresh',{})};
(async()=>{
 assert.equal((await route.GET(req('jobs',null,null))).status,401);
 assert.equal((await route.POST(req('jobs',{requestId:crypto.randomUUID(),kind:'image',prompt:'test'},'alice','https://evil.test'))).status,403);
 const requestId=crypto.randomUUID();let first=await start({requestId});assert.equal(first.status,202);assert.equal(first.job.state,'processing');assert.equal(createCalls,1);assert.equal(lastCreate.background,true);assert.equal(lastCreate.store,true);
 await start({requestId});assert.equal(createCalls,1);
 assert.equal((await get('jobs/'+first.job.id,'bob')).status,404);assert.equal((await get('jobs','bob')).jobs.length,0);
 assert.equal((await post('jobs/'+first.job.id+'/refresh',{},'bob')).status,404);
 assert.equal((await poll(first.job)).job.state,'processing');const p=pollCalls;await post('jobs/'+first.job.id+'/refresh',{});assert.equal(pollCalls,p);
 mode='provider-failure';assert.equal((await poll(first.job)).job.state,'processing');assert.equal(createCalls,1);
 mode='done';storageFails=true;assert.equal((await poll(first.job)).job.state,'processing');storageFails=false;
 const complete=await poll(first.job);assert.equal(complete.job.state,'succeeded');assert.equal(files.size,1);assert.equal(createCalls,1);
 assert.equal((await get('jobs/'+first.job.id)).job.fileUrl,complete.job.fileUrl);assert.equal((await get('jobs/'+first.job.id+'/file','bob')).status,404);
 const file=await route.GET(req('jobs/'+first.job.id+'/file',null));assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png');assert.equal(Buffer.from(await file.arrayBuffer()).toString('base64'),png);
 const rangeReq=req('jobs/'+first.job.id+'/file',null);rangeReq.headers.set('range','bytes=0-7');const range=await route.GET(rangeReq);assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8);
 const edit=await start({parentId:first.job.id,prompt:'꽃을 더 넣어줘'});assert.equal(edit.status,202);assert.equal(lastCreate.previous_response_id,'resp_1');assert.equal((await start({parentId:first.job.id},'bob')).status,404);
 mode='submission-timeout';const t=await start();assert.equal(t.job.state,'unknown');const before=createCalls;await start({requestId:t.job.requestId});assert.equal(createCalls,before);
 mode='pending';moderationInvalid=true;const blocked=await start();assert.equal(blocked.job.state,'failed');assert.equal(createCalls,before);moderationInvalid=false;
 const expired=await start();mode='expired';assert.equal((await poll(expired.job)).job.state,'failed');
 assert.equal((await start({kind:'video'})).status,503);
 env.GEMINI_API_KEY='test-google';env.VIDEO_GENERATION_ENABLED='true';assert.equal((await start({kind:'video'})).status,503);env.VIDEO_DAILY_LIMIT='2';
 mode='pending';const v=await start({kind:'video'});assert.equal(v.status,202);assert.equal(lastCreate.parameters.durationSeconds,8);
 mode='done';unsafeVideo=true;assert.equal((await poll(v.job)).job.state,'processing');assert.equal(externalCalls,0);
 unsafeVideo=false;videoRedirect=true;const doneVideo=await poll(v.job);assert.equal(doneVideo.job.state,'succeeded');assert.equal(storageHadKey,false);
 const videoFile=await route.GET(req('jobs/'+v.job.id+'/file',null));assert.equal(videoFile.headers.get('content-type'),'video/mp4');
 mode='pending';await start({kind:'video'});const n=createCalls;const limited=await start({kind:'video'});assert.equal(limited.job.state,'failed');assert.equal(createCalls,n);
 // A result remains retrievable with creation disabled; refresh never creates work.
 env.GENERATION_ENABLED='false';assert.equal((await get('jobs/'+first.job.id)).job.state,'succeeded');assert.equal((await start()).status,503);
 assert.equal((await get('jobs')).jobs.some(j=>j.provider_id||j.user||j.object),false);
 console.log('PASS: background acceptance, duplicate protection, auth/ownership, bounded polling, storage recovery, private file/range reads, edit ownership, unknown submission recovery, moderation rejection, video gates/quotas, safe download redirects. No live API calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
