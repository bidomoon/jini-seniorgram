// Provider-owned background work. No paid create request is automatically retried.
export type JobEnv = {DB?:D1Database;BUCKET?:R2Bucket;OPENAI_API_KEY?:string;GENERATION_ENABLED?:string;OPENAI_IMAGE_MODEL?:string;GENERATION_DAILY_LIMIT?:string;OPENAI_RESPONSE_MODEL?:string;GEMINI_API_KEY?:string;VIDEO_GENERATION_ENABLED?:string;VIDEO_DAILY_LIMIT?:string};
type Job = {id:string;user:string;request_id:string;kind:'image'|'video';prompt:string;state:string;provider_id:string|null;object:string|null;message:string|null;created:number;checked:number;parent_id:string|null};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const fail=(error:string,status=400)=>json({error},status);
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{16,64}$/.test(id);
const day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const validLimit=(n:string|undefined)=>Number.isInteger(Number(n))&&Number(n)>0&&Number(n)<=10000;
const active=(state:string)=>['submitting','processing'].includes(state);
export function jobReadiness(e:JobEnv){return {imageReady:!!(e.DB&&e.BUCKET&&e.OPENAI_API_KEY&&e.GENERATION_ENABLED==='true'&&validLimit(e.GENERATION_DAILY_LIMIT)),videoReady:!!(e.DB&&e.BUCKET&&e.OPENAI_API_KEY&&e.GEMINI_API_KEY&&e.VIDEO_GENERATION_ENABLED==='true'&&validLimit(e.VIDEO_DAILY_LIMIT))}}
function dto(j:Job){const stale=j.state==='submitting'&&Date.now()-j.created>120000;return {id:j.id,requestId:j.request_id,kind:j.kind,prompt:j.prompt,state:stale?'unknown':j.state,created:j.created,message:stale?'접수 여부를 확인하지 못했어요. 자동으로 다시 만들지 않습니다.':j.message,fileUrl:j.state==='succeeded'&&j.object?'/api/sg/jobs/'+j.id+'/file':null}}
async function own(e:JobEnv,user:string,id:string){return e.DB!.prepare('SELECT * FROM generation_jobs WHERE id=? AND user=?').bind(id,user).first<Job>()}
async function request(url:string,key:string,data?:unknown,google=false){return fetch(url,{method:data===undefined?'GET':'POST',headers:{...(google?{'x-goog-api-key':key}:{Authorization:'Bearer '+key}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(45000),redirect:'error'})}
async function openai(e:JobEnv,path:string,data?:unknown){return request('https://api.openai.com/v1/'+path,e.OPENAI_API_KEY!,data)}
async function gemini(e:JobEnv,path:string,data?:unknown){return request('https://generativelanguage.googleapis.com/v1beta/'+path,e.GEMINI_API_KEY!,data,true)}
async function setFailure(e:JobEnv,j:Job,message:string,state='failed'){await e.DB!.prepare('UPDATE generation_jobs SET state=?,message=? WHERE id=?').bind(state,message,j.id).run();j.state=state;j.message=message;return j}
async function reserve(e:JobEnv,user:string,kind:string){const month=kind==='image'?day().slice(0,7):'video:'+day().slice(0,7),siteDay='global:'+kind+':'+day(),limit=Number(kind==='image'?e.GENERATION_DAILY_LIMIT:e.VIDEO_DAILY_LIMIT),personal=kind==='image'?10:2;
 await e.DB!.prepare('INSERT OR IGNORE INTO quota(user,month,used) VALUES(?,?,0)').bind(user,month).run();
 const used=await e.DB!.prepare('SELECT used FROM quota WHERE user=? AND month=?').bind(user,month).first<{used:number}>();if((used?.used||0)>=personal)return '이번 달 체험 횟수를 모두 사용했어요.';
 await e.DB!.prepare('INSERT OR IGNORE INTO quota(user,month,used) VALUES(?,?,0)').bind('__site__',siteDay).run();
 if(!await e.DB!.prepare('UPDATE quota SET used=used+1 WHERE user=? AND month=? AND used<? RETURNING used').bind('__site__',siteDay,limit).first())return '오늘 준비한 전체 이용량을 모두 사용했어요.';
 if(!await e.DB!.prepare('UPDATE quota SET used=used+1 WHERE user=? AND month=? AND used<? RETURNING used').bind(user,month,personal).first())return '이번 달 체험 횟수를 모두 사용했어요.';
 return null;
}
async function start(e:JobEnv,user:string,b:any){
 if(!validId(b.requestId)||!['image','video'].includes(b.kind)||typeof b.prompt!=='string'||b.prompt.trim().length<3||b.prompt.length>800)return fail('만들고 싶은 장면을 3~800자로 적어주세요.');
 const previous=await e.DB!.prepare('SELECT * FROM generation_jobs WHERE user=? AND request_id=?').bind(user,b.requestId).first<Job>();if(previous)return json({job:dto(previous)},active(previous.state)?202:200);
 if(!jobReadiness(e)[b.kind==='image'?'imageReady':'videoReady'])return fail(b.kind==='video'?'AI 영상 연결을 준비하고 있어요. 영상 카드는 지금 만들 수 있어요.':'AI 그림 연결을 준비하고 있어요.',503);
 let parent:Job|null=null;if(b.parentId){if(b.kind!=='image'||!validId(b.parentId))return fail('수정할 그림을 확인해주세요.');parent=await own(e,user,b.parentId);if(!parent||parent.kind!=='image'||parent.state!=='succeeded'||!parent.provider_id)return fail('내가 만든 완성된 그림만 수정할 수 있어요.',404)}
 const j:Job={id:crypto.randomUUID(),user,request_id:b.requestId,kind:b.kind,prompt:b.prompt.trim(),state:'submitting',provider_id:null,object:null,message:null,created:Date.now(),checked:0,parent_id:parent?.id||null};
 const claimed=await e.DB!.prepare('INSERT OR IGNORE INTO generation_jobs(id,user,request_id,kind,prompt,state,created,parent_id) VALUES(?,?,?,?,?,?,?,?) RETURNING id').bind(j.id,user,j.request_id,j.kind,j.prompt,j.state,j.created,j.parent_id).first();
 if(!claimed){const existing=await e.DB!.prepare('SELECT * FROM generation_jobs WHERE user=? AND request_id=?').bind(user,j.request_id).first<Job>();return existing?json({job:dto(existing)},202):fail('요청을 확인하고 있어요.',503)}
 let submitting=false;
 try{
  const quotaError=await reserve(e,user,j.kind);if(quotaError){await setFailure(e,j,quotaError);return json({job:dto(j)},200)}
  const mod=await openai(e,'moderations',{model:'omni-moderation-latest',input:j.prompt});const m:any=await mod.json();
  if(!mod.ok||!Array.isArray(m.results)||!m.results.length||m.results.some((x:any)=>typeof x.flagged!=='boolean'))throw Error('moderation unavailable');
  if(m.results.some((x:any)=>x.flagged)){await setFailure(e,j,'이 내용은 만들 수 없어요. 다른 장면을 적어주세요.');return json({job:dto(j)})}
  submitting=true;
  const r=j.kind==='image'?await openai(e,'responses',{model:e.OPENAI_RESPONSE_MODEL||'gpt-5.4-mini',background:true,store:true,max_tool_calls:1,parallel_tool_calls:false,tool_choice:{type:'image_generation'},tools:[{type:'image_generation',model:e.OPENAI_IMAGE_MODEL||'gpt-image-2',size:'1024x1024',quality:'high',output_format:'png'}],instructions:'Generate exactly one image. Follow the Korean request faithfully. Preserve requested Korean text. Do not add text, borders or logos unless requested. For edits preserve the original image except for requested changes.',input:j.prompt,...(parent?{previous_response_id:parent.provider_id}:{})}):await gemini(e,'models/veo-3.1-fast-generate-preview:predictLongRunning',{instances:[{prompt:j.prompt}],parameters:{aspectRatio:'9:16',resolution:'1080p',durationSeconds:8,sampleCount:1,personGeneration:'allow_adult'}});
  if(!r.ok){await setFailure(e,j,r.status===429?'AI 이용 한도에 도달했어요. 잠시 후 확인해주세요.':'AI 요청을 접수하지 못했어요. 운영자가 연결 상태를 확인해야 해요.');return json({job:dto(j)})}
  const data:any=await r.json();const pid=j.kind==='image'?data.id:data.name;
  if(typeof pid!=='string'||!(j.kind==='image'?/^resp_[A-Za-z0-9_-]+$/:/^models\/veo-3\.1-fast-generate-preview\/operations\/[A-Za-z0-9_-]+$/).test(pid))throw Error('missing operation id');
  await e.DB!.prepare('UPDATE generation_jobs SET provider_id=?,state=? WHERE id=?').bind(pid,'processing',j.id).run();j.provider_id=pid;j.state='processing';
  return json({job:dto(j)},202);
 }catch{await setFailure(e,j,submitting?'접수 결과가 불확실해요. 중복 결제를 막기 위해 자동으로 다시 만들지 않습니다.':'안전 확인 또는 연결에 실패했어요. 입력 내용은 남아 있어요.',submitting?'unknown':'failed');return json({job:dto(j)})}
}
async function boundedBytes(r:Response,max:number){if(Number(r.headers.get('content-length'))>max)throw Error('file too large');const reader=r.body?.getReader();if(!reader)throw Error('empty file');const parts:Uint8Array[]=[];let length=0;while(true){const p=await reader.read();if(p.done)break;length+=p.value.length;if(length>max){await reader.cancel();throw Error('file too large')}parts.push(p.value)}const bytes=new Uint8Array(length);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return bytes}
async function videoBytes(e:JobEnv,uri:string){let url=new URL(uri);for(let i=0;i<4;i++){
 const googleApi=url.hostname==='generativelanguage.googleapis.com';const storage=url.hostname==='storage.googleapis.com'||url.hostname.endsWith('.googleusercontent.com');
 if(url.protocol!=='https:'||url.username||url.password||url.port||(!googleApi&&!storage))throw Error('unsafe video URL');
 const r=await fetch(url.href,{headers:googleApi?{'x-goog-api-key':e.GEMINI_API_KEY!}:{},redirect:'manual',signal:AbortSignal.timeout(60000)});
 if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');if(!next)throw Error('missing redirect');url=new URL(next,url);continue}
 if(!r.ok)throw Error('video download unavailable');const bytes=await boundedBytes(r,40*1024*1024);if(bytes.length<12||String.fromCharCode(...bytes.slice(4,8))!=='ftyp')throw Error('invalid video');return bytes;
 }throw Error('video redirect limit');
}
async function refresh(e:JobEnv,j:Job){
 if(j.state!=='processing'||!j.provider_id)return json({job:dto(j)});
 // A short database lease bounds concurrent refreshes without creating new work.
 const lease=await e.DB!.prepare('UPDATE generation_jobs SET checked=? WHERE id=? AND state=? AND checked<? RETURNING id').bind(Date.now(),j.id,'processing',Date.now()-10000).first();if(!lease)return json({job:dto(j)},202);
 try{
  const r=j.kind==='image'?await openai(e,'responses/'+encodeURIComponent(j.provider_id)):await gemini(e,j.provider_id);
  if(r.status===404){await setFailure(e,j,'AI 결과 보관 기간이 지났거나 작업을 찾을 수 없어요.');return json({job:dto(j)})}
  if(!r.ok)return json({job:dto(j),notice:'결과 연결을 다시 확인하고 있어요. 새로 생성하지 않습니다.'},202);
  const d:any=await r.json();let bytes:Uint8Array;
  if(j.kind==='image'){
   if(['queued','in_progress'].includes(d.status))return json({job:dto(j)},202);
   if(d.status!=='completed'){await setFailure(e,j,'그림을 완성하지 못했어요. 다른 내용으로 새로 요청할 수 있어요.');return json({job:dto(j)})}
   const b64=d.output?.find((x:any)=>x.type==='image_generation_call')?.result;
   if(typeof b64!=='string'||b64.length>16000000||!b64.startsWith('iVBORw0KGgo')){await setFailure(e,j,'완성된 그림 파일을 받지 못했어요.');return json({job:dto(j)})}
   bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  }else{
   if(d.error){await setFailure(e,j,'영상을 완성하지 못했어요. 내용을 바꿔 새로 요청할 수 있어요.');return json({job:dto(j)})}
   if(d.done!==true)return json({job:dto(j)},202);
   const uri=d.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
   if(typeof uri!=='string'){await setFailure(e,j,'안전 확인 또는 생성 과정에서 영상이 완성되지 않았어요.');return json({job:dto(j)})}
   bytes=await videoBytes(e,uri);
  }
  const key='generations/'+j.id+(j.kind==='image'?'.png':'.mp4');
  await e.BUCKET!.put(key,bytes,{httpMetadata:{contentType:j.kind==='image'?'image/png':'video/mp4'}});
  await e.DB!.prepare('UPDATE generation_jobs SET state=?,object=?,message=NULL WHERE id=?').bind('succeeded',key,j.id).run();j.state='succeeded';j.object=key;j.message=null;
  return json({job:dto(j)});
 }catch{return json({job:dto(j),notice:'완성 여부를 다시 확인할 수 있어요. 추가 생성은 하지 않았습니다.'},202)}
}
export async function jobGET(e:JobEnv,req:Request,user:string,path:string){if(!e.DB)return fail('작품 보관함을 준비하고 있어요.',503);
 if(path==='jobs'){const rows=await e.DB.prepare('SELECT * FROM generation_jobs WHERE user=? ORDER BY created DESC LIMIT 30').bind(user).all<Job>();return json({jobs:rows.results.map(dto)})}
 const match=path.match(/^jobs\/([a-zA-Z0-9-]{16,64})(\/file)?$/);if(!match)return fail('없는 주소예요.',404);const j=await own(e,user,match[1]);if(!j)return fail('내 작품을 찾을 수 없어요.',404);
 if(!match[2])return json({job:dto(j)});
 if(j.state!=='succeeded'||!j.object||!e.BUCKET)return fail('완성된 파일을 준비하고 있어요.',404);
 const file=await e.BUCKET.get(j.object,{range:req.headers});if(!file)return fail('파일을 찾을 수 없어요.',404);
 const headers=new Headers({'Content-Type':j.kind==='image'?'image/png':'video/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
 let status=200;if(file.range&&'offset' in file.range&&'length' in file.range){headers.set('Content-Range',`bytes ${file.range.offset}-${file.range.offset!+file.range.length!-1}/${file.size}`);headers.set('Content-Length',String(file.range.length));status=206}else headers.set('Content-Length',String(file.size));
 if(new URL(req.url).searchParams.get('download')==='1')headers.set('Content-Disposition',`attachment; filename="seniorgram-${j.kind==='image'?'image.png':'video.mp4'}"`);
 return new Response(file.body,{status,headers});
}
export async function jobPOST(e:JobEnv,user:string,path:string,b:any){if(!e.DB||!e.BUCKET)return fail('작품 보관함을 준비하고 있어요.',503);if(path==='jobs')return start(e,user,b);
 const match=path.match(/^jobs\/([a-zA-Z0-9-]{16,64})\/refresh$/);if(!match)return fail('없는 요청이에요.',404);const j=await own(e,user,match[1]);return j?refresh(e,j):fail('내 작품을 찾을 수 없어요.',404);
}
