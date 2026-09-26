import {jobGET,jobPOST,jobReadiness} from '../jobs';
import { env } from 'cloudflare:workers';
const e=env as unknown as {DB?:D1Database;BUCKET?:R2Bucket;OPENAI_API_KEY?:string;GENERATION_ENABLED?:string;OPENAI_IMAGE_MODEL?:string;GENERATION_DAILY_LIMIT?:string};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(message:string,status=400)=>reply({error:message},status);
function koreaDate(){return new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10)}
function user(req:Request){return req.headers.get('oai-authenticated-user-id')}
async function body(req:Request,max=9000){const reader=req.body?.getReader();if(!reader)throw Error('empty');let size=0,text='';const decoder=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>max){await reader.cancel();throw Error('large')}text+=decoder.decode(r.value,{stream:true})}text+=decoder.decode();return JSON.parse(text)}
async function api(path:string,data:unknown){return fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+e.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(path==='images/generations'?300000:30000)})}
export async function GET(req:Request){const id=user(req);if(!id)return error('로그인이 필요해요.',401);const path=new URL(req.url).pathname.split('/api/sg/')[1];try{
if(path==='jobs'||path?.startsWith('jobs/'))return await jobGET(e,req,id,path);
if(path==='status'){const keyReady=!!e.OPENAI_API_KEY,enabled=e.GENERATION_ENABLED==='true',limit=Number(e.GENERATION_DAILY_LIMIT),limitsReady=Number.isInteger(limit)&&limit>0&&limit<=10000;const usage=e.DB?await e.DB.prepare('SELECT used FROM quota WHERE user=? AND month=?').bind(id,koreaDate().slice(0,7)).first<{used:number}>():null;return reply({...jobReadiness(e),communityReady:keyReady&&enabled&&!!e.DB&&!!e.BUCKET,mode:'private-beta',monthlyTrialLimit:10,used:usage?.used||0,remaining:Math.max(0,10-(usage?.used||0)),subscriptionActive:false,connectionState:!keyReady?'key_missing':!enabled?'disabled':!limitsReady?'limits_missing':!e.DB?'storage_missing':'configured',liveApiVerified:false})}
if(path==='feed'){const postId=new URL(req.url).searchParams.get('post');if(postId&&postId.length>80)return error('작품 주소를 확인해주세요.');if(!e.DB)return error('작품 보기를 준비하고 있어요.',503);const rows=await e.DB.prepare('SELECT p.id,p.title,p.created,p.owner=? AS mine,(SELECT count(*) FROM likes l WHERE l.post=p.id) AS likes,EXISTS(SELECT 1 FROM likes l WHERE l.post=p.id AND l.user=?) AS liked FROM posts p WHERE p.hidden=0 AND (? IS NULL OR p.id=?) AND p.owner NOT IN (SELECT blocked FROM blocks WHERE user=?) ORDER BY p.created DESC LIMIT 30').bind(id,id,postId,postId,id).all();return reply({posts:rows.results})}
if(path?.startsWith('image/')){if(!e.DB||!e.BUCKET)return error('준비 중이에요.',503);const p=await e.DB.prepare('SELECT object FROM posts WHERE id=? AND hidden=0 AND owner NOT IN (SELECT blocked FROM blocks WHERE user=?)').bind(path.slice(6),id).first<{object:string}>();if(!p)return error('작품을 찾을 수 없어요.',404);const img=await e.BUCKET.get(p.object);return img?new Response(img.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=120','X-Content-Type-Options':'nosniff'}}):error('이미지가 없어요.',404)}return error('없는 주소예요.',404)
}catch{return error('잠시 후 다시 시도해주세요.',503)}}
export async function POST(req:Request){const id=user(req);if(!id)return error('로그인이 필요해요.',401);if(req.headers.get('origin')!==new URL(req.url).origin)return error('앱에서 다시 시도해주세요.',403);if(!req.headers.get('content-type')?.includes('application/json'))return error('잘못된 요청이에요.',415);const path=new URL(req.url).pathname.split('/api/sg/')[1];try{
if(path==='jobs'||path?.startsWith('jobs/'))return await jobPOST(e,id,path,await body(req));
if(path==='generate'){
if(!e.OPENAI_API_KEY||e.GENERATION_ENABLED!=='true')return error('AI 연결 준비 중이에요. 지금은 예시 카드로 만들 수 있어요.',503);
if(!e.DB)return error('이용량 확인을 준비 중이에요.',503);
const b=await body(req);const prompt=typeof b.prompt==='string'?b.prompt.trim():'';
if(prompt.length<3||prompt.length>800)return error('원하는 그림을 3~800자로 적어주세요.');
if(typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(b.requestId))return error('화면을 다시 열고 시도해주세요.');
const style=['알아서 어울리게','따뜻한 사진','수채화','귀여운 그림'].includes(b.style)?b.style:'알아서 어울리게';
const claim=await e.DB.prepare('INSERT OR IGNORE INTO generation_requests(user,id,state,created) VALUES(?,?,?,?) RETURNING id').bind(id,b.requestId,'pending',Date.now()).first();
if(!claim){const old=await e.DB.prepare('SELECT state FROM generation_requests WHERE user=? AND id=?').bind(id,b.requestId).first<{state:string}>();return error(old?.state==='succeeded'?'이미 완료된 요청이에요. 결과를 받지 못했다면 새로 요청하기를 눌러주세요.':'이 요청은 이미 접수됐어요. 중복 생성을 막았습니다. 새로 요청하려면 아래 버튼을 눌러주세요.',409)}
const finish=async(message:string,status=400,state='failed')=>{await e.DB!.prepare('UPDATE generation_requests SET state=? WHERE user=? AND id=?').bind(state,id,b.requestId).run();return error(message,status)};
try{
const month=koreaDate().slice(0,7),day='global:image:'+koreaDate();
await e.DB.prepare('INSERT OR IGNORE INTO quota(user,month,used) VALUES(?,?,0)').bind(id,month).run();
const used=await e.DB.prepare('SELECT used FROM quota WHERE user=? AND month=?').bind(id,month).first<{used:number}>();
if((used?.used||0)>=10)return await finish('이번 달 체험 10회를 모두 사용했어요.',429);
const daily=Number(e.GENERATION_DAILY_LIMIT);if(!Number.isInteger(daily)||daily<1||daily>10000)return await finish('전체 이용 한도를 준비하고 있어요. 잠시 후 다시 시도해주세요.',503);
await e.DB.prepare('INSERT OR IGNORE INTO quota(user,month,used) VALUES(?,?,0)').bind('__site__',day).run();
const global=await e.DB.prepare('UPDATE quota SET used=used+1 WHERE user=? AND month=? AND used<? RETURNING used').bind('__site__',day,daily).first();
if(!global)return await finish('오늘 준비한 AI 이용량을 모두 사용했어요. 내일 다시 이용해주세요.',429);
const reserved=await e.DB.prepare('UPDATE quota SET used=used+1 WHERE user=? AND month=? AND used<10 RETURNING used').bind(id,month).first<{used:number}>();
if(!reserved)return await finish('이번 달 체험 10회를 모두 사용했어요.',429);
// Conservative attempt reservation: uncertain upstream outcomes never trigger an automatic paid retry.
const moderated=await api('moderations',{model:'omni-moderation-latest',input:prompt});
if(!moderated.ok)return await finish('안전 확인에 실패했어요. 잠시 후 새로 요청해주세요.',502);
const m=await moderated.json() as {results?:{flagged:boolean}[]};
if(!Array.isArray(m.results)||!m.results.length||m.results.some(x=>typeof x.flagged!=='boolean'))return await finish('안전 확인 결과를 받지 못했어요.',502);
if(m.results.some(x=>x.flagged))return await finish('이 내용은 만들 수 없어요. 다른 그림을 부탁해주세요.');
const response=await api('images/generations',{model:e.OPENAI_IMAGE_MODEL||'gpt-image-2',prompt:`Create a polished, high-quality original image following this Korean user request faithfully: ${prompt}. Preferred style when the user has not specified one: ${style}. If set to 알아서 어울리게, infer the most suitable style from the request. Preserve all requested subjects, composition and Korean text. Use harmonious lighting and clean detail. Do not assume this is a greeting card. Do not add borders, watermarks, logos, or text unless requested.`,n:1,size:'1024x1024',quality:'high',output_format:'png'});
if(!response.ok)return await finish(response.status===429?'AI 이용량 또는 연결 상태를 확인해야 해요. 잠시 후 다시 이용해주세요.':'그림을 만들지 못했어요. 운영자가 연결 상태를 확인해야 합니다.',502);
const result=await response.json() as {data?:{b64_json?:string}[]};const image=result.data?.[0]?.b64_json;
if(typeof image!=='string'||image.length>16000000||!image.startsWith('iVBORw0KGgo'))return await finish('이미지 응답을 확인하지 못했어요.',502);
await e.DB.prepare('UPDATE generation_requests SET state=? WHERE user=? AND id=?').bind('succeeded',id,b.requestId).run();
return reply({image:'data:image/png;base64,'+image,remaining:10-reserved.used});
}catch{return await finish('연결이 끊겼거나 시간이 오래 걸렸어요. 같은 요청은 자동으로 반복하지 않습니다. 새로 요청하면 이용량이 다시 사용될 수 있어요.',502,'unknown')}
}
if(!e.DB||!e.BUCKET)return error('커뮤니티를 준비 중이에요.',503);
if(path==='publish'){const b=await body(req,3500000);if(b.consent!==true)return error('작품 공개에 동의해주세요.');const title=typeof b.title==='string'?b.title.trim().slice(0,80):'';if(!title)return error('작품 제목을 적어주세요.');if(typeof b.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.image))return error('PNG 작품만 올릴 수 있어요.');if(!e.OPENAI_API_KEY||e.GENERATION_ENABLED!=='true')return error('작품 안전 검사를 연결한 뒤 공개할 수 있어요. 외부 공유와 저장은 사용할 수 있습니다.',503);
const bytes=Uint8Array.from(atob(b.image.split(',')[1]),c=>c.charCodeAt(0));if(bytes.length>2500000||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return error('2.5MB 이하 PNG 작품만 올릴 수 있어요.');
const day='publish:'+new Date().toISOString().slice(0,10);await e.DB.prepare('INSERT OR IGNORE INTO quota(user,month,used) VALUES(?,?,0)').bind(id,day).run();const publishQuota=await e.DB.prepare('UPDATE quota SET used=used+1 WHERE user=? AND month=? AND used<10 RETURNING used').bind(id,day).first();if(!publishQuota)return error('오늘 작품 올리기 10회를 모두 사용했어요.',429);
const mod=await api('moderations',{model:'omni-moderation-latest',input:[{type:'text',text:title},{type:'image_url',image_url:{url:b.image}}]});const mr=await mod.json() as any;if(!mod.ok||!mr.results?.length)return error('안전 확인을 마치지 못했어요.',502);if(mr.results.some((x:any)=>x.flagged))return error('이 작품은 공개할 수 없어요.');const pid=crypto.randomUUID(),key='posts/'+pid+'.png';await e.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/png'}});try{await e.DB.prepare('INSERT INTO posts(id,owner,title,object,created) VALUES(?,?,?,?,?)').bind(pid,id,title,key,Date.now()).run()}catch{await e.BUCKET.delete(key);throw Error('db')}return reply({id:pid})}
const b=await body(req);if(typeof b.id!=='string'||b.id.length>80)return error('작품을 선택해주세요.');const post=await e.DB.prepare('SELECT owner,object FROM posts WHERE id=? AND hidden=0').bind(b.id).first<{owner:string;object:string}>();if(!post)return error('작품을 찾을 수 없어요.',404);
if(path==='like'){if(typeof b.liked!=='boolean')return error('잘못된 요청이에요.');if(b.liked)await e.DB.prepare('INSERT OR IGNORE INTO likes(post,user) VALUES(?,?)').bind(b.id,id).run();else await e.DB.prepare('DELETE FROM likes WHERE post=? AND user=?').bind(b.id,id).run();return reply({ok:true})}
if(path==='report'){await e.DB.prepare('INSERT OR REPLACE INTO reports(post,user,reason) VALUES(?,?,?)').bind(b.id,id,String(b.reason||'검토 요청').slice(0,200)).run();return reply({ok:true})}
if(path==='block'){if(post.owner===id)return error('내 작품은 숨기기 대신 삭제할 수 있어요.');await e.DB.prepare('INSERT OR IGNORE INTO blocks(user,blocked) VALUES(?,?)').bind(id,post.owner).run();return reply({ok:true})}
if(path==='delete'){if(post.owner!==id)return error('내 작품만 삭제할 수 있어요.',403);await e.DB.prepare('UPDATE posts SET hidden=1 WHERE id=? AND owner=?').bind(b.id,id).run();await e.BUCKET.delete(post.object);return reply({ok:true})}return error('없는 요청이에요.',404)
}catch{return error('요청을 완료하지 못했어요. 입력이나 연결 상태를 확인해주세요.',503)}}
