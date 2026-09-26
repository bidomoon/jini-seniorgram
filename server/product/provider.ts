import {Dependencies,ProductError} from './types';
import {failJob} from './ledger';
export function jobDTO(j:any){return {id:j.id,requestId:j.request_id,kind:j.kind,prompt:j.prompt,state:j.state==='submitting'&&Date.now()-new Date(j.created_at).getTime()>90000?'unknown':j.state,created:new Date(j.created_at).getTime(),message:j.message,usageState:j.usage_state,fileUrl:j.state==='succeeded'&&j.object_key&&!j.deleted_at?'/api/sg/jobs/'+j.id+'/file':null}}
export async function boundedBytes(r:Response,max:number){
 if(Number(r.headers.get('content-length'))>max)throw Error('FILE_TOO_LARGE');
 const reader=r.body?.getReader();if(!reader)throw Error('EMPTY_FILE');const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw Error('FILE_TOO_LARGE')}chunks.push(part.value)}
 const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length}return bytes;
}
async function provider(d:Dependencies,path:string,body?:unknown,google=false,timeout=15000){
 return d.fetch((google?'https://generativelanguage.googleapis.com/v1beta/':'https://api.openai.com/v1/')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(google?{'x-goog-api-key':d.env('GEMINI_API_KEY')!}:{Authorization:'Bearer '+d.env('OPENAI_API_KEY')})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeout)});
}
export async function moderate(d:Dependencies,input:unknown){
 const r=await provider(d,'moderations',{model:'omni-moderation-latest',input});if(!r.ok)throw Error('MODERATION_UNAVAILABLE');
 const data:any=await r.json();if(!Array.isArray(data.results)||!data.results.length||data.results.some((x:any)=>typeof x.flagged!=='boolean'))throw Error('MODERATION_UNAVAILABLE');
 return !data.results.some((x:any)=>x.flagged);
}
export async function submit(d:Dependencies,j:any,parent:any){let sent=false;
 try{
  if(!await moderate(d,j.prompt))return failJob(d,j,'이 내용은 만들 수 없어요. 이용 횟수는 돌려드렸어요.');
  sent=true;
  const r=j.kind==='image'?await provider(d,'responses',{model:d.env('OPENAI_RESPONSE_MODEL')||'gpt-5.4-mini',background:true,store:true,max_tool_calls:1,parallel_tool_calls:false,tool_choice:{type:'image_generation'},tools:[{type:'image_generation',model:d.env('OPENAI_IMAGE_MODEL')||'gpt-image-2',size:'1024x1024',quality:'high',output_format:'png'}],instructions:'Generate exactly one image. Follow the Korean request faithfully and preserve requested Korean text. Do not add text, borders, watermarks or logos unless requested. For edits preserve the original image except for the requested changes.',input:j.prompt,...(parent?{previous_response_id:parent.provider_id}:{})}):await provider(d,'models/veo-3.1-fast-generate-preview:predictLongRunning',{instances:[{prompt:j.prompt}],parameters:{aspectRatio:'9:16',resolution:'1080p',durationSeconds:8,sampleCount:1,personGeneration:'allow_adult'}},true);
  if(!r.ok){const uncertain=r.status>=500||r.status===408;return failJob(d,j,uncertain?'접수 확인이 필요해요. 자동으로 다시 만들지 않습니다.':'요청이 거절되었어요. 이용 횟수는 돌려드렸어요.',uncertain)}
  const data:any=await r.json(),pid=j.kind==='image'?data.id:data.name;
  if(typeof pid!=='string'||!(j.kind==='image'?/^resp_[A-Za-z0-9_-]+$/:/^models\/veo-3\.1-fast-generate-preview\/operations\/[A-Za-z0-9_-]+$/).test(pid))throw Error('PROVIDER_ID_MISSING');
  return (await d.query("UPDATE sg_jobs SET provider_id=$1,state='processing' WHERE id=$2 AND state='submitting' RETURNING *",[pid,j.id])).rows[0]||j;
 }catch{return failJob(d,j,sent?'접수 여부를 확인하고 있어요. 같은 요청을 자동으로 다시 만들지 않습니다.':'안전 확인을 마치지 못했어요. 이용 횟수는 돌려드렸어요.',sent)}
}
async function video(d:Dependencies,uri:string,timeout:number){let u=new URL(uri);
 for(let i=0;i<4;i++){
  const api=u.hostname==='generativelanguage.googleapis.com',storage=u.hostname==='storage.googleapis.com'||u.hostname.endsWith('.googleusercontent.com');
  if(u.protocol!=='https:'||u.port||u.username||u.password||(!api&&!storage))throw Error('UNSAFE_FILE_URL');
  const r=await d.fetch(u.href,{headers:api?{'x-goog-api-key':d.env('GEMINI_API_KEY')!}:{},redirect:'manual',signal:AbortSignal.timeout(timeout)});
  if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');if(!next)throw Error('INVALID_REDIRECT');u=new URL(next,u);continue}
  if(!r.ok)throw Error('VIDEO_DOWNLOAD');const bytes=await boundedBytes(r,18*1024*1024);if(bytes.length<12||Buffer.from(bytes.subarray(4,8)).toString()!=='ftyp')throw Error('INVALID_VIDEO');return bytes;
 }throw Error('TOO_MANY_REDIRECTS');
}
export async function refresh(d:Dependencies,j:any,scheduled=false){
 if(j.state!=='processing'||!j.provider_id||j.deleted_at)return j;
 // The lease exceeds a synchronous function's execution lifetime.
 const lease=(await d.query("UPDATE sg_jobs SET checked_at=now() WHERE id=$1 AND state='processing' AND deleted_at IS NULL AND (checked_at IS NULL OR checked_at<now()-interval '90 seconds') RETURNING id",[j.id])).rows;
 if(!lease.length)return j;
 try{
  const r=await provider(d,j.kind==='image'?'responses/'+encodeURIComponent(j.provider_id):j.provider_id,undefined,j.kind==='video',scheduled?7000:15000);
  if(r.status===404)return failJob(d,j,'보관된 AI 작업을 찾지 못했어요. 이용 횟수는 돌려드렸어요.');
  if(!r.ok)return j;const raw=await boundedBytes(r,22*1024*1024),data=JSON.parse(new TextDecoder().decode(raw));let bytes:Uint8Array;
  if(j.kind==='image'){
   if(['queued','in_progress'].includes(data.status))return j;
   if(data.status!=='completed')return failJob(d,j,'그림을 완성하지 못했어요. 이용 횟수는 돌려드렸어요.');
   const b64=data.output?.find((x:any)=>x.type==='image_generation_call')?.result;
   if(typeof b64!=='string'||b64.length>16000000||!/^iVBORw0KGgo[A-Za-z0-9+/=\r\n]*$/.test(b64))return failJob(d,j,'완성된 그림 파일을 받지 못했어요. 이용 횟수는 돌려드렸어요.');
   bytes=new Uint8Array(Buffer.from(b64,'base64'));
  }else{
   if(data.error)return failJob(d,j,'영상을 완성하지 못했어요. 이용 횟수는 돌려드렸어요.');
   if(data.done!==true)return j;const uri=data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
   if(typeof uri!=='string')return failJob(d,j,'영상이 완성되지 않았어요. 이용 횟수는 돌려드렸어요.');bytes=await video(d,uri,scheduled?9000:15000);
  }
  const key='members/'+j.account_id+'/jobs/'+j.id+(j.kind==='image'?'.png':'.mp4');
  await d.files.put(key,bytes,j.kind==='image'?'image/png':'video/mp4');
  // Deletion and completion serialize on the account; deletion always queues the deterministic key.
  return await d.transaction(async q=>{
   const a=(await q('SELECT deleted_at FROM sg_accounts WHERE id=$1 FOR UPDATE',[j.account_id])).rows[0];
   if(!a||a.deleted_at){await q('INSERT INTO sg_file_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING',[key]);return j}
   const result=(await q("UPDATE sg_jobs SET state='succeeded',object_key=$1,message=NULL,usage_state='consumed' WHERE id=$2 AND state='processing' AND deleted_at IS NULL RETURNING *",[key,j.id])).rows[0];
   if(!result)await q('INSERT INTO sg_file_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING',[key]);return result||j;
  });
 }catch{return j}
}
export async function serveFile(d:Dependencies,request:Request,key:string,type:string){
 const buffer=await d.files.get(key);if(!buffer)throw new ProductError('파일을 찾을 수 없어요.',404);const bytes=new Uint8Array(buffer),headers=new Headers({'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
 let start=0,end=bytes.length-1,status=200;const range=request.headers.get('range');
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.length}});
  if(!m[1])start=Math.max(0,bytes.length-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end)}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.length}});
  status=206;headers.set('Content-Range',`bytes ${start}-${end}/${bytes.length}`);
 }
 headers.set('Content-Length',String(end-start+1));if(new URL(request.url).searchParams.get('download')==='1')headers.set('Content-Disposition','attachment; filename="seniorgram.'+(type==='image/png'?'png':'mp4')+'"');
 // A stream prevents Lambda's buffered-response limit from truncating video files.
 return new Response(new Blob([bytes.slice(start,end+1)]).stream(),{status,headers});
}
