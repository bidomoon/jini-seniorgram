import {randomUUID} from 'node:crypto';
import {allowedOrigin,trustedOrigin,cookie} from '../commerce/security';
import {Dependencies,ProductError,readiness,uuid,koreanDay} from './types';
import {account,usage,claimTrial,reserveJob,daily} from './ledger';
import {jobDTO,submit,refresh,moderate,serveFile,boundedBytes} from './provider';
export async function product(request:Request,d:Dependencies):Promise<Response>{
 const u=new URL(request.url),path=u.pathname,origin=trustedOrigin(d.env('APP_ORIGIN')),ready=readiness(d.env);
 const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 const need=(value:boolean,message='아직 연결을 준비하고 있어요.')=>{if(!value)throw new ProductError(message,503)};
 const body=async(max=8192)=>{if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ProductError('앱 화면에서 다시 시도해주세요.',415);try{return JSON.parse(new TextDecoder().decode(await boundedBytes(new Response(request.body),max)))}catch{throw new ProductError('입력 내용을 확인해주세요.')}};
 try{
  if(request.method==='POST'&&(!origin||u.origin!==origin||!allowedOrigin(request,origin)))throw new ProductError('앱 화면에서 다시 시도해주세요.',403);
  if(!['GET','POST'].includes(request.method))return json({error:'지원하지 않는 요청입니다.'},405);
  // Configuration stays readable even before a database is configured.
  if(path==='/api/sg/status'&&request.method==='GET'){
   const a=ready.database?await account(request,d):null,credits=a?await usage(d.query,a.id):null;
   return json({...ready,authenticated:!!a,signInUrl:'/api/auth/kakao/start',remaining:credits?.imagesRemaining||0,videoRemaining:credits?.videosRemaining||0,trialClaimed:credits?.trialClaimed||false,monthlyTrialLimit:3,used:0,liveApiVerified:false,deployment:'netlify',mode:'private-beta',subscriptionActive:!!credits?.periods.some(p=>['google-play','kakaopay'].includes(p.source))});
  }
  need(ready.database,'회원 서버 연결을 준비하고 있어요. 예시 카드는 지금 만들 수 있습니다.');
  const a=await account(request,d);if(!a)throw new ProductError('카카오로 로그인한 뒤 이용해주세요.',401);
  if(path==='/api/account/usage'&&request.method==='GET')return json({...(await usage(d.query,a.id)),trialAvailable:ready.trialAvailable,checkoutReady:false});
  if(path==='/api/account/trial'&&request.method==='POST'){need(ready.trialAvailable,'AI 그림 체험 연결을 준비하고 있어요.');const b=await body();if(b.consent!==true)throw new ProductError('무료체험 안내를 확인해주세요.');return json(await claimTrial(d,a.id))}
  if(path==='/api/account/feedback'&&request.method==='POST'){
   const b=await body();if(!['help','bug','idea','refund','cancel'].includes(b.category)||typeof b.message!=='string'||b.message.trim().length<3||b.message.length>2000)throw new ProductError('문의 종류와 내용을 확인해주세요.');
   const id=randomUUID();await d.transaction(async q=>{await q('SELECT id FROM sg_accounts WHERE id=$1 FOR UPDATE',[a.id]);const count=(await q("SELECT count(*)::int AS n FROM sg_feedback WHERE account_id=$1 AND created_at>now()-interval '1 day'",[a.id])).rows[0];if(count.n>=10)throw new ProductError('문의는 하루 10개까지 보낼 수 있어요.',429);await q('INSERT INTO sg_feedback(id,account_id,category,message) VALUES($1,$2,$3,$4)',[id,a.id,b.category,b.message.trim()])});return json({id,message:'문의를 접수했어요. 내 문의에서 처리 상태를 확인할 수 있습니다.'});
  }
  if(path==='/api/account/feedback'&&request.method==='GET')return json({items:(await d.query('SELECT id,category,message,status,created_at FROM sg_feedback WHERE account_id=$1 ORDER BY created_at DESC LIMIT 30',[a.id])).rows});
  if(path==='/api/account/delete'&&request.method==='POST'){
   const b=await body();if(b.confirmation!=='탈퇴합니다')throw new ProductError('“탈퇴합니다”를 입력해주세요.');
   await d.transaction(async q=>{
    await q('SELECT id FROM sg_accounts WHERE id=$1 FOR UPDATE',[a.id]);
    const active=(await q("SELECT id FROM sg_entitlements WHERE account_id=$1 AND source IN ('google-play','kakaopay') AND revoked_at IS NULL AND (ends_at IS NULL OR ends_at>now()) LIMIT 1",[a.id])).rows;
    // Until provider cancellation is integrated, never imply deletion stops billing.
    if(active.length)throw new ProductError('먼저 구독을 해지해주세요. 구독 확인이 끝난 뒤 탈퇴를 완료할 수 있습니다.',409);
    await q("INSERT INTO sg_file_deletions(object_key) SELECT 'members/'||account_id||'/jobs/'||id||CASE WHEN kind='image' THEN '.png' ELSE '.mp4' END FROM sg_jobs WHERE account_id=$1 ON CONFLICT DO NOTHING",[a.id]);
    await q('INSERT INTO sg_file_deletions(object_key) SELECT object_key FROM sg_posts WHERE account_id=$1 ON CONFLICT DO NOTHING',[a.id]);
    await q("UPDATE sg_jobs SET deleted_at=now(),prompt='',message=NULL WHERE account_id=$1",[a.id]);
    await q("UPDATE sg_posts SET state='hidden',title='' WHERE account_id=$1",[a.id]);
    await q('DELETE FROM sg_likes WHERE account_id=$1',[a.id]);await q('DELETE FROM sg_blocks WHERE account_id=$1 OR blocked_id=$1',[a.id]);await q('DELETE FROM sg_reports WHERE account_id=$1',[a.id]);await q('DELETE FROM sg_feedback WHERE account_id=$1',[a.id]);
    await q('UPDATE sg_entitlements SET revoked_at=now() WHERE account_id=$1',[a.id]);await q('DELETE FROM sg_sessions WHERE account_id=$1',[a.id]);
    await q("UPDATE sg_accounts SET deleted_at=now(),nickname='',kakao_id='deleted:'||id WHERE id=$1",[a.id]);
   });const r=json({ok:true,message:'탈퇴가 완료되어 작품이 더 이상 표시되지 않습니다. 보관 파일 삭제를 처리합니다. 카카오의 연결된 서비스 관리에서도 시니어그램 연결을 해제할 수 있어요.'});r.headers.set('Set-Cookie',cookie('__Host-sg-session','',0));return r;
  }
  if(path==='/api/sg/jobs'&&request.method==='GET')return json({jobs:(await d.query('SELECT * FROM sg_jobs WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60',[a.id])).rows.map(jobDTO)});
  if(path==='/api/sg/jobs'&&request.method==='POST'){
   const b=await body();if(!uuid(b.requestId)||!['image','video'].includes(b.kind)||typeof b.prompt!=='string'||b.prompt.trim().length<3||b.prompt.length>800||(b.parentId&&(!uuid(b.parentId)||b.kind!=='image')))throw new ProductError('만들고 싶은 장면을 3~800자로 적어주세요.');
   const old=(await d.query('SELECT * FROM sg_jobs WHERE account_id=$1 AND request_id=$2',[a.id,b.requestId])).rows[0];if(old){if(old.deleted_at)throw new ProductError('삭제된 요청입니다. 새 요청을 준비해주세요.',410);return json({job:jobDTO(old)})}
   need(b.kind==='image'?ready.imageReady:ready.videoReady,b.kind==='image'?'AI 그림 연결을 준비하고 있어요.':'AI 영상 연결을 준비하고 있어요.');
   const reserved=await reserveJob(d,a.id,{...b,prompt:b.prompt.trim()});const j=reserved.created?await submit(d,reserved.job,reserved.parent):reserved.job;return json({job:jobDTO(j)},['submitting','processing'].includes(j.state)?202:200);
  }
  const jm=path.match(/^\/api\/sg\/jobs\/([^/]+)(?:\/(file|refresh|delete))?$/);
  if(jm){if(!uuid(jm[1]))throw new ProductError('작품을 찾을 수 없어요.',404);const j=(await d.query('SELECT * FROM sg_jobs WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL',[jm[1],a.id])).rows[0];if(!j)throw new ProductError('내 작품을 찾을 수 없어요.',404);
   if(!jm[2]&&request.method==='GET')return json({job:jobDTO(j)});
   if(jm[2]==='refresh'&&request.method==='POST'){need(ready.storage);return json({job:jobDTO(await refresh(d,j))})}
   if(jm[2]==='file'&&request.method==='GET'){if(j.state!=='succeeded'||!j.object_key)throw new ProductError('완성된 파일을 준비하고 있어요.',404);return serveFile(d,request,j.object_key,j.kind==='image'?'image/png':'video/mp4')}
   if(jm[2]==='delete'&&request.method==='POST'){if(['submitting','processing','unknown'].includes(j.state))throw new ProductError('진행 중이거나 접수 확인 중인 작품은 결과 확인 후 삭제할 수 있어요.',409);await d.transaction(async q=>{await q('SELECT id FROM sg_accounts WHERE id=$1 FOR UPDATE',[a.id]);await q("UPDATE sg_jobs SET deleted_at=now(),prompt='' WHERE id=$1 AND account_id=$2",[j.id,a.id]);if(j.object_key)await q('INSERT INTO sg_file_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING',[j.object_key])});return json({ok:true})}
  }
  if(path==='/api/sg/feed'&&request.method==='GET'){
   const post=u.searchParams.get('post');if(post&&!uuid(post))throw new ProductError('작품 주소를 확인해주세요.');return json({posts:(await d.query("SELECT p.id,p.title,p.created_at AS created,p.account_id=$1 AS mine,(SELECT count(*)::int FROM sg_likes l WHERE l.post_id=p.id) AS likes,EXISTS(SELECT 1 FROM sg_likes l WHERE l.post_id=p.id AND l.account_id=$1) AS liked FROM sg_posts p WHERE p.state='visible' AND ($2::uuid IS NULL OR p.id=$2) AND NOT EXISTS(SELECT 1 FROM sg_blocks b WHERE b.account_id=$1 AND b.blocked_id=p.account_id) ORDER BY p.created_at DESC LIMIT 30",[a.id,post])).rows});
  }
  const image=path.match(/^\/api\/sg\/image\/([^/]+)$/);if(image&&request.method==='GET'){
   if(!uuid(image[1]))throw new ProductError('작품을 찾을 수 없어요.',404);const p=(await d.query("SELECT object_key FROM sg_posts p WHERE id=$1 AND state='visible' AND NOT EXISTS(SELECT 1 FROM sg_blocks b WHERE b.account_id=$2 AND b.blocked_id=p.account_id)",[image[1],a.id])).rows[0];if(!p)throw new ProductError('작품을 찾을 수 없어요.',404);return serveFile(d,request,p.object_key,'image/png');
  }
  if(path==='/api/sg/publish'&&request.method==='POST'){
   need(ready.communityReady,'작품 공개 연결을 준비하고 있어요. 파일 저장과 외부 공유는 이용할 수 있습니다.');const b=await body(3500000);
   if(!uuid(b.requestId)||b.consent!==true||typeof b.title!=='string'||!b.title.trim()||b.title.length>80||typeof b.image!=='string'||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(b.image))throw new ProductError('작품 제목과 공개 동의를 확인해주세요.');
   const bytes=new Uint8Array(Buffer.from(b.image.split(',')[1],'base64'));if(bytes.length>2500000)throw new ProductError('2.5MB 이하 PNG 작품만 올릴 수 있어요.');
   const post=await d.transaction(async q=>{await q('SELECT id FROM sg_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[a.id]);const old=(await q('SELECT * FROM sg_posts WHERE account_id=$1 AND request_id=$2',[a.id,b.requestId])).rows[0];if(old)return {row:old,new:false};const n=(await q("SELECT count(*)::int AS n FROM sg_posts WHERE account_id=$1 AND created_at>now()-interval '1 day'",[a.id])).rows[0].n;if(n>=10)throw new ProductError('하루 10개까지 올릴 수 있어요.',429);await daily(q,'publish',100);const id=randomUUID(),key='members/'+a.id+'/posts/'+id+'.png';return {row:(await q("INSERT INTO sg_posts(id,account_id,request_id,title,object_key,state) VALUES($1,$2,$3,$4,$5,'reviewing') RETURNING *",[id,a.id,b.requestId,b.title.trim(),key])).rows[0],new:true}});
   if(!post.new){if(post.row.state==='visible')return json({id:post.row.id});throw new ProductError('이미 접수된 게시물입니다. 우리 피드에서 확인해주세요.',409)}
   try{if(!await moderate(d,[{type:'text',text:b.title},{type:'image_url',image_url:{url:b.image}}]))throw new ProductError('이 작품은 피드에 공개할 수 없어요.');await d.files.put(post.row.object_key,bytes,'image/png');await d.transaction(async q=>{const current=(await q('SELECT deleted_at FROM sg_accounts WHERE id=$1 FOR UPDATE',[a.id])).rows[0];if(current?.deleted_at)throw new ProductError('다시 로그인해주세요.',401);await q("UPDATE sg_posts SET state='visible' WHERE id=$1 AND state='reviewing'",[post.row.id])});return json({id:post.row.id})}
   catch(e){await d.query("UPDATE sg_posts SET state='rejected' WHERE id=$1",[post.row.id]);await d.query('INSERT INTO sg_file_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING',[post.row.object_key]);throw e instanceof ProductError?e:new ProductError('안전 확인을 마치지 못해 게시하지 않았어요.',503)}
  }
  if(['/api/sg/like','/api/sg/report','/api/sg/block','/api/sg/delete'].includes(path)&&request.method==='POST'){
   const b=await body();if(!uuid(b.id))throw new ProductError('작품을 선택해주세요.');const p=(await d.query("SELECT * FROM sg_posts WHERE id=$1 AND state='visible'",[b.id])).rows[0];if(!p)throw new ProductError('작품을 찾을 수 없어요.',404);
   if(path.endsWith('/like')){if(typeof b.liked!=='boolean')throw new ProductError('요청을 확인해주세요.');if(b.liked)await d.query('INSERT INTO sg_likes(post_id,account_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[b.id,a.id]);else await d.query('DELETE FROM sg_likes WHERE post_id=$1 AND account_id=$2',[b.id,a.id])}
   if(path.endsWith('/report')){await d.query('INSERT INTO sg_reports(post_id,account_id,reason) VALUES($1,$2,$3) ON CONFLICT(post_id,account_id) DO UPDATE SET reason=EXCLUDED.reason,reviewed_at=NULL',[b.id,a.id,String(b.reason||'검토 요청').slice(0,200)]);if(p.account_id!==a.id)await d.query('INSERT INTO sg_blocks(account_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,p.account_id])}
   if(path.endsWith('/block')){if(p.account_id===a.id)throw new ProductError('내 작품은 삭제할 수 있어요.');await d.query('INSERT INTO sg_blocks(account_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[a.id,p.account_id])}
   if(path.endsWith('/delete')){if(p.account_id!==a.id)throw new ProductError('내 작품만 삭제할 수 있어요.',403);await d.transaction(async q=>{await q("UPDATE sg_posts SET state='hidden' WHERE id=$1",[b.id]);await q('INSERT INTO sg_file_deletions(object_key) VALUES($1) ON CONFLICT DO NOTHING',[p.object_key])})}return json({ok:true});
  }
  if(path.startsWith('/api/admin/')){
   const admins=(d.env('ADMIN_ACCOUNT_IDS')||'').split(',').map(x=>x.trim());if(!admins.includes(a.id))throw new ProductError('접근 권한이 없어요.',403);
   if(path==='/api/admin/review'&&request.method==='GET')return json({reports:(await d.query('SELECT r.post_id,r.reason,r.created_at,p.title,p.state FROM sg_reports r JOIN sg_posts p ON p.id=r.post_id WHERE reviewed_at IS NULL ORDER BY r.created_at LIMIT 50')).rows,feedback:(await d.query("SELECT id,category,message,created_at FROM sg_feedback WHERE status='open' ORDER BY created_at LIMIT 50")).rows,unknownJobs:(await d.query("SELECT id,kind,created_at FROM sg_jobs WHERE state='unknown' OR (state='submitting' AND created_at<now()-interval '90 seconds') ORDER BY created_at LIMIT 50")).rows});
   if(path==='/api/admin/review'&&request.method==='POST'){const b=await body();if(!uuid(b.id)||!['hide-post','keep-post','resolve-feedback'].includes(b.action))throw new ProductError('처리할 항목을 확인해주세요.');await d.transaction(async q=>{if(b.action==='resolve-feedback')await q("UPDATE sg_feedback SET status='resolved' WHERE id=$1",[b.id]);else{if(b.action==='hide-post')await q("UPDATE sg_posts SET state='hidden' WHERE id=$1",[b.id]);await q('UPDATE sg_reports SET reviewed_at=now() WHERE post_id=$1',[b.id])}await q('INSERT INTO sg_admin_events(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),a.id,b.action,b.id])});return json({ok:true})}
  }
  return json({error:'요청한 기능을 찾지 못했어요.'},404);
 }catch(e){return json({error:e instanceof ProductError?e.message:'연결을 마치지 못했어요. 잠시 후 다시 확인해주세요.'},e instanceof ProductError?e.status:503)}
}
