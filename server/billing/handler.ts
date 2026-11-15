import {allowedOrigin,trustedOrigin,readBody} from '../commerce/security';
import {account} from '../product/ledger';
import {Dependencies,ProductError} from '../product/types';
import {playConfig,playHash,syncPurchase,synchronizeMember,validPurchaseToken} from './play';
import type {PlayProvider} from './google';
export async function playBilling(request:Request,d:Dependencies,p:PlayProvider):Promise<Response>{
 const url=new URL(request.url),origin=trustedOrigin(d.env('APP_ORIGIN')),config=playConfig(d.env);
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 try{
  if(url.pathname==='/api/billing/play/config'&&request.method==='GET')return json({ready:config.ready,live:config.ready&&config.live,packageName:config.packageName,products:config.ready?config.plans:[],message:config.ready?'Google Play 구매 내역을 확인할 수 있어요.':'Google Play 구매 연결을 준비하고 있어요.'});
  if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
  if(!config.ready)throw new ProductError('구매 확인 연결을 준비하고 있어요.',503);
  const notification=url.pathname==='/api/billing/play/notifications';
  if(notification){
   if(!origin||url.origin!==origin)throw new ProductError('알림 주소를 확인해주세요.',403);
   const audience=d.env('PLAY_PUSH_AUDIENCE'),email=d.env('PLAY_PUSH_EMAIL');
   // The audience is the exact canonical webhook URL; never derive it from the Host header.
   if(!origin||audience!==origin+'/api/billing/play/notifications'||!email)throw new ProductError('구매 알림 연결을 준비하고 있어요.',503);
   const bearer=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{50,8192})$/)?.[1];
   if(!bearer||!await p.verifyPush(bearer,audience,email))throw new ProductError('인증되지 않은 알림입니다.',401);
   let body;try{body=await readBody(request)}catch{throw new ProductError('알림 형식을 확인해주세요.')}
   if(typeof body.message?.data!=='string'||body.message.data.length>6000||!/^[-A-Za-z0-9+/=_]+$/.test(body.message.data))throw new ProductError('알림 형식을 확인해주세요.');
   let event;try{event=JSON.parse(Buffer.from(body.message.data,'base64').toString('utf8'))}catch{throw new ProductError('알림 형식을 확인해주세요.')}
   if(event.packageName!==config.packageName)throw new ProductError('앱 정보를 확인해주세요.');
   if(event.testNotification)return json({ok:true});
   const token=event.subscriptionNotification?.purchaseToken;
   if(!validPurchaseToken(token))throw new ProductError('구독 알림을 확인해주세요.');
   const owner=(await d.query('SELECT p.account_id FROM sg_play_purchases p JOIN sg_accounts a ON a.id=p.account_id WHERE p.token_hash=$1 AND a.deleted_at IS NULL',[playHash(token)])).rows[0];
   // Purchases interrupted before first client binding can be recovered with restore.
   if(!owner)return json({ok:true,unclaimed:true},202);
   await syncPurchase(d,p,owner.account_id,token);return json({ok:true});
  }
  if(!origin||url.origin!==origin||!allowedOrigin(request,origin))throw new ProductError('시니어그램 화면에서 다시 시도해주세요.',403);
  const member=await account(request,d);if(!member)throw new ProductError('카카오로 로그인한 뒤 구매를 복원해주세요.',401);
  if(url.pathname==='/api/billing/play/verify'){
   let body;try{body=await readBody(request)}catch{throw new ProductError('구매 확인 정보를 확인해주세요.')}
   if(body.bindConsent!==true||!validPurchaseToken(body.purchaseToken))throw new ProductError('현재 카카오 계정에 구매를 연결하는 안내를 확인해주세요.');
   return json({purchase:await syncPurchase(d,p,member.id,body.purchaseToken)});
  }
  if(url.pathname==='/api/billing/play/sync')return json({purchases:await synchronizeMember(d,p,member.id)});
  return json({error:'요청한 기능을 찾을 수 없어요.'},404);
 }catch(error){return json({error:error instanceof ProductError?error.message:'구매 확인을 마치지 못했어요. 다시 구매하지 말고 잠시 후 복원해주세요.'},error instanceof ProductError?error.status:503)}
}
