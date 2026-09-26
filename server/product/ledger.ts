import {randomUUID} from 'node:crypto';
import {cookieValue,hashToken} from '../commerce/security';
import {Dependencies,Query,ProductError,koreanDay} from './types';
export async function account(request:Request,d:Pick<Dependencies,'query'>){
 const token=cookieValue(request,'__Host-sg-session');if(!token)return null;
 return (await d.query('SELECT a.id,a.nickname FROM sg_sessions s JOIN sg_accounts a ON a.id=s.account_id WHERE s.hash=$1 AND s.expires_at>now() AND a.deleted_at IS NULL',[hashToken(token)])).rows[0]||null;
}
export async function usage(q:Query,id:string){
 const rows=(await q('SELECT source,image_limit,image_used,video_limit,video_used,ends_at FROM sg_entitlements WHERE account_id=$1 AND revoked_at IS NULL AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) ORDER BY ends_at NULLS LAST',[id])).rows;
 return {imagesRemaining:rows.reduce((n,r)=>n+r.image_limit-r.image_used,0),videosRemaining:rows.reduce((n,r)=>n+r.video_limit-r.video_used,0),trialClaimed:!!(await q("SELECT id FROM sg_entitlements WHERE reference=$1",['trial:'+id])).rows.length,periods:rows};
}
export async function claimTrial(d:Dependencies,id:string){return d.transaction(async q=>{
 const a=(await q('SELECT id FROM sg_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows[0];if(!a)throw new ProductError('다시 로그인해주세요.',401);
 await q("INSERT INTO sg_entitlements(id,account_id,source,reference,image_limit,video_limit) VALUES($1,$2,'trial',$3,3,0) ON CONFLICT(reference) DO NOTHING",[randomUUID(),id,'trial:'+id]);
 return usage(q,id);
})}
export async function daily(q:Query,kind:string,limit:number){
 await q('INSERT INTO sg_daily_usage(day,kind) VALUES($1,$2) ON CONFLICT DO NOTHING',[koreanDay(),kind]);
 if(!(await q('UPDATE sg_daily_usage SET used=used+1 WHERE day=$1 AND kind=$2 AND used<$3 RETURNING used',[koreanDay(),kind,limit])).rows.length)throw new ProductError('오늘 준비한 이용량을 모두 사용했어요. 내일 다시 이용해주세요.',429);
}
export async function reserveJob(d:Dependencies,id:string,b:{requestId:string;kind:'image'|'video';prompt:string;parentId?:string}){return d.transaction(async q=>{
 if(!(await q('SELECT id FROM sg_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id])).rows.length)throw new ProductError('다시 로그인해주세요.',401);
 const old=(await q('SELECT * FROM sg_jobs WHERE account_id=$1 AND request_id=$2',[id,b.requestId])).rows[0];if(old)return {job:old,created:false};
 let parent=null;if(b.parentId){parent=(await q("SELECT * FROM sg_jobs WHERE id=$1 AND account_id=$2 AND kind='image' AND state='succeeded' AND deleted_at IS NULL",[b.parentId,id])).rows[0];if(!parent?.provider_id)throw new ProductError('내가 만든 완성된 그림만 수정할 수 있어요.',404)}
 const col=b.kind==='image'?'image':'video';
 const grant=(await q(`SELECT id FROM sg_entitlements WHERE account_id=$1 AND revoked_at IS NULL AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) AND ${col}_used<${col}_limit ORDER BY ends_at NULLS LAST,created_at LIMIT 1 FOR UPDATE`,[id])).rows[0];
 if(!grant)throw new ProductError(b.kind==='image'?'그림 이용 횟수가 없어요. 내 이용권에서 무료 체험이나 이용권을 확인해주세요.':'영상 이용권이 필요해요. 내 이용권에서 확인해주세요.',402);
 await daily(q,b.kind,Number(d.env(b.kind==='image'?'GENERATION_DAILY_LIMIT':'VIDEO_DAILY_LIMIT')));
 await q(`UPDATE sg_entitlements SET ${col}_used=${col}_used+1 WHERE id=$1`,[grant.id]);
 const job=(await q("INSERT INTO sg_jobs(id,account_id,request_id,kind,prompt,state,parent_id,entitlement_id) VALUES($1,$2,$3,$4,$5,'submitting',$6,$7) RETURNING *",[randomUUID(),id,b.requestId,b.kind,b.prompt,b.parentId||null,grant.id])).rows[0];
 return {job,created:true,parent};
})}
// A provider timeout is ambiguous: keep the reservation and never resubmit.
// A verified failure restores the member's credit, but not the daily attempt cap.
export async function failJob(d:Dependencies,j:any,message:string,unknown=false){return d.transaction(async q=>{
 const row=(await q("UPDATE sg_jobs SET state=$1,message=$2 WHERE id=$3 AND state IN ('submitting','processing') RETURNING *",[unknown?'unknown':'failed',message,j.id])).rows[0];
 if(row&&!unknown&&row.usage_state==='reserved'){
  await q("UPDATE sg_jobs SET usage_state='refunded' WHERE id=$1",[j.id]);
  const col=row.kind==='image'?'image_used':'video_used';await q(`UPDATE sg_entitlements SET ${col}=${col}-1 WHERE id=$1 AND ${col}>0`,[row.entitlement_id]);
 }
 return row?{...row,usage_state:unknown?row.usage_state:'refunded'}:j;
})}
