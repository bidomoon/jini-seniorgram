import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {Dependencies,ProductError,readiness} from '../product/types';
import type {PlayProvider} from './google';
export const playHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const validPurchaseToken=(v:unknown):v is string=>typeof v==='string'&&v.length>=16&&v.length<=4096&&/^[A-Za-z0-9._~+\/=:-]+$/.test(v);
function encryptionKey(env:Dependencies['env']){const value=env('PLAY_TOKEN_KEY')||'';if(!/^[A-Za-z0-9+/]{43}=$/.test(value))return null;const key=Buffer.from(value,'base64');return key.length===32?key:null}
export function encryptPurchase(token:string,env:Dependencies['env']){const key=encryptionKey(env);if(!key)throw new ProductError('구매 확인 연결을 준비하고 있어요.',503);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('seniorgram-play-v1'));const bytes=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(x=>x.toString('base64')).join('.')}
export function decryptPurchase(value:string,env:Dependencies['env']){const key=encryptionKey(env);if(!key)throw Error('PLAY_STORAGE_UNAVAILABLE');const parts=value.split('.');if(parts.length!==3)throw Error('PLAY_STORAGE_UNAVAILABLE');const [iv,tag,bytes]=parts.map(x=>Buffer.from(x,'base64'));const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('seniorgram-play-v1'));cipher.setAuthTag(tag);return Buffer.concat([cipher.update(bytes),cipher.final()]).toString('utf8')}
function quota(env:Dependencies['env'],key:string){const v=env(key)||'';return /^[1-9]\d{0,3}$/.test(v)?Number(v):0}
export function playConfig(env:Dependencies['env']){
 const product=(key:string)=>/^[a-z0-9][a-z0-9._-]{0,99}$/.test(env(key)||'')?env(key)!:'';
 const plans=[{id:'image',product:product('PLAY_IMAGE_PRODUCT'),images:quota(env,'PLAY_IMAGE_LIMIT'),videos:0},{id:'video',product:product('PLAY_VIDEO_PRODUCT'),images:quota(env,'PLAY_VIDEO_IMAGE_LIMIT'),videos:quota(env,'PLAY_VIDEO_LIMIT')}];
 const packageName=env('PLAY_PACKAGE_NAME')||'app.jininova.seniorgram';
 const configured=readiness(env).database&&env('BILLING_SCHEMA_VERSION')==='1'&&env('PLAY_BILLING_ENABLED')==='true'&&/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageName)&&env('PLAY_CREDENTIALS_READY')==='true'&&!!encryptionKey(env)&&plans.every(p=>p.product&&p.images>0)&&plans[1].videos>0&&plans[0].product!==plans[1].product;
 // Test receipts can be connected first; live purchases require separately verified acceptance.
 const live=env('PLAY_LIVE_VERIFIED')==='true'&&env('PLAY_SYNC_ENABLED')==='true'&&!!env('PLAY_PUSH_EMAIL')&&env('PLAY_PUSH_AUDIENCE')===env('APP_ORIGIN')+'/api/billing/play/notifications'&&readiness(env).imageReady&&readiness(env).videoReady;
 return {ready:configured,live,packageName,plans};
}
const activeStates=new Set(['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED']);
const knownStates=new Set([...activeStates,'SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED']);
// Caller-supplied notification type, product ID, price and expiry never grant access.
export function parsePurchase(raw:any,config:ReturnType<typeof playConfig>){
 if(!raw||!knownStates.has(raw.subscriptionState)||!Array.isArray(raw.lineItems)||raw.lineItems.length!==1)throw new ProductError('구매 내역을 확인하지 못했어요. 다시 구매하지 말고 잠시 후 복원해주세요.',502);
 const item=raw.lineItems[0],plan=config.plans.find(p=>p.product===item.productId);
 if(!plan)throw new ProductError('시니어그램 이용권 구매 내역이 아니에요.',400);
 if(raw.testPurchase!==undefined&&(!raw.testPurchase||typeof raw.testPurchase!=='object'||Array.isArray(raw.testPurchase)))throw new ProductError('구매 정보를 확인하지 못했어요.',502);
 const test=raw.testPurchase!==undefined;
 if(!test&&!config.live)throw new ProductError('실제 결제 이용권 연결은 아직 열리지 않았어요.',503);
 const expires=Date.parse(item.expiryTime);if(activeStates.has(raw.subscriptionState)&&!Number.isFinite(expires))throw new ProductError('구독 만료 정보를 확인하지 못했어요.',502);
 const active=activeStates.has(raw.subscriptionState)&&Number.isFinite(expires)&&expires>Date.now();
 if(active&&(!/^[A-Za-z0-9._-]{6,200}$/.test(item.latestSuccessfulOrderId||'')||!['ACKNOWLEDGEMENT_STATE_PENDING','ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(raw.acknowledgementState)||typeof item.autoRenewingPlan?.autoRenewEnabled!=='boolean'))throw new ProductError('구독 확인 정보가 부족해요. 다시 구매하지 말고 복원을 이용해주세요.',502);
 if(raw.linkedPurchaseToken!==undefined&&!validPurchaseToken(raw.linkedPurchaseToken))throw new ProductError('구매 연결 정보를 확인하지 못했어요.',502);
 return {state:raw.subscriptionState as string,plan,active,test,expires:Number.isFinite(expires)?new Date(expires).toISOString():null,order:typeof item.latestSuccessfulOrderId==='string'?item.latestSuccessfulOrderId:null,ack:raw.acknowledgementState,linked:raw.linkedPurchaseToken as string|undefined,autoRenewing:item.autoRenewingPlan?.autoRenewEnabled===true};
}
export async function syncPurchase(d:Dependencies,p:PlayProvider,accountId:string,token:string){
 const config=playConfig(d.env);if(!config.ready)throw new ProductError('구매 확인 연결을 준비하고 있어요.',503);
 if(!validPurchaseToken(token))throw new ProductError('구매 확인 정보를 확인해주세요.');
 const hash=playHash(token);
 return d.transaction(async q=>{
  if(!(await q('SELECT id FROM sg_accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[accountId])).rows.length)throw new ProductError('다시 로그인해주세요.',401);
  await q("INSERT INTO sg_play_purchases(token_hash,account_id,token_cipher,state) VALUES($1,$2,$3,'unverified') ON CONFLICT(token_hash) DO NOTHING",[hash,accountId,encryptPurchase(token,d.env)]);
  const saved=(await q('SELECT * FROM sg_play_purchases WHERE token_hash=$1 FOR UPDATE',[hash])).rows[0];
  if(saved.account_id!==accountId)throw new ProductError('이 구매는 다른 시니어그램 계정에 연결되어 있어요.',409);
  // Fetch while holding the row lock so stale concurrent responses cannot undo a refund.
  let raw;try{raw=await p.get(config.packageName,token)}catch{throw new ProductError('Google Play 구매 확인이 지연되고 있어요. 다시 구매하지 말고 잠시 후 복원해주세요.',503)}
  const receipt=parsePurchase(raw,config);
  const obfuscated=raw.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if(obfuscated&&obfuscated!==playHash('seniorgram:'+accountId))throw new ProductError('구매한 시니어그램 계정으로 로그인해주세요.',409);
  if(saved.replaced_by_hash)receipt.active=false;
  const reference='play:'+hash+':'+playHash(receipt.order||'inactive');
  if(receipt.linked){
   const oldHash=playHash(receipt.linked);if(oldHash===hash)throw new ProductError('구매 연결 정보를 확인하지 못했어요.',502);
   // Reserve an unseen predecessor too, so later restoring it cannot claim a second account.
   await q("INSERT INTO sg_play_purchases(token_hash,account_id,token_cipher,state,replaced_by_hash) VALUES($1,$2,'','replaced',$3) ON CONFLICT(token_hash) DO NOTHING",[oldHash,accountId,hash]);
   const old=(await q('SELECT account_id FROM sg_play_purchases WHERE token_hash=$1',[oldHash])).rows[0];
   if(old&&old.account_id!==accountId)throw new ProductError('이전 구매와 같은 시니어그램 계정으로 로그인해주세요.',409);
   if(old)await q('UPDATE sg_play_purchases SET replaced_by_hash=$1 WHERE token_hash=$2',[hash,oldHash]);
   if(old)await q("UPDATE sg_entitlements SET revoked_at=now() WHERE account_id=$1 AND source='google-play' AND reference LIKE $2",[accountId,'play:'+oldHash+':%']);
  }
  await q("UPDATE sg_entitlements SET revoked_at=now() WHERE account_id=$1 AND source='google-play' AND reference LIKE $2 AND reference<>$3",[accountId,'play:'+hash+':%',reference]);
  if(receipt.active){
   if(receipt.ack==='ACKNOWLEDGEMENT_STATE_PENDING')try{await p.acknowledge(config.packageName,receipt.plan.product,token)}catch{throw new ProductError('구매 승인 확인이 지연되고 있어요. 다시 구매하지 말고 잠시 후 복원해주세요.',503)}
   await q("INSERT INTO sg_entitlements(id,account_id,source,reference,ends_at,image_limit,video_limit) VALUES($1,$2,'google-play',$3,$4,$5,$6) ON CONFLICT(reference) DO UPDATE SET ends_at=EXCLUDED.ends_at,revoked_at=NULL",[randomUUID(),accountId,reference,receipt.expires,receipt.plan.images,receipt.plan.videos]);
  }else await q("UPDATE sg_entitlements SET revoked_at=now() WHERE account_id=$1 AND source='google-play' AND reference LIKE $2",[accountId,'play:'+hash+':%']);
  await q('UPDATE sg_play_purchases SET product_id=$1,state=$2,expires_at=$3,order_id=$4,is_test=$5,auto_renewing=$6,checked_at=now() WHERE token_hash=$7',[receipt.plan.product,receipt.state,receipt.expires,receipt.order,receipt.test,receipt.autoRenewing,hash]);
  return {state:receipt.state,active:receipt.active,plan:receipt.plan.id,expires:receipt.expires,test:receipt.test,autoRenewing:receipt.autoRenewing};
 });
}
export async function synchronizeMember(d:Dependencies,p:PlayProvider,accountId:string){
 const rows=(await d.query("SELECT token_cipher FROM sg_play_purchases WHERE account_id=$1 AND replaced_by_hash IS NULL AND token_cipher<>'' ORDER BY expires_at DESC NULLS FIRST,checked_at NULLS FIRST LIMIT 2",[accountId])).rows;
 const results=[];for(const row of rows)results.push(await syncPurchase(d,p,accountId,decryptPurchase(row.token_cipher,d.env)));return results;
}

// The existing maintenance job may reconcile a bounded batch only after the
// owner explicitly enables PLAY_SYNC_ENABLED. It never initiates a charge.
export async function reconcilePlay(d:Dependencies,p:PlayProvider){
 if(d.env('PLAY_SYNC_ENABLED')!=='true'||!playConfig(d.env).ready)return;
 const due=(await d.query("SELECT p.account_id,p.token_cipher FROM sg_play_purchases p JOIN sg_accounts a ON a.id=p.account_id WHERE a.deleted_at IS NULL AND p.replaced_by_hash IS NULL AND p.token_cipher<>'' AND (p.checked_at IS NULL OR p.checked_at<now()-interval '30 minutes') ORDER BY p.checked_at NULLS FIRST LIMIT 2")).rows;
 for(const row of due)try{await syncPurchase(d,p,row.account_id,decryptPurchase(row.token_cipher,d.env))}catch{/* Keep verified grants unchanged on ambiguity; no token/member data is logged. */}
}
