import {randomUUID} from 'node:crypto';
import {plans,planFor,trialImages,commercialCheckoutReady,verifyPayment} from './plans';
import {randomToken,hashToken,same,cookie,cookieValue,allowedOrigin,trustedOrigin,safePaymentURL,readBody} from './security';
import {readiness} from '../product/types';
import {usage} from '../product/ledger';
type Dependencies={env:(key:string)=>string|undefined;query:(sql:string,values?:unknown[])=>Promise<{rows:any[]}>;fetch:typeof fetch};
export async function commerce(request:Request,d:Dependencies):Promise<Response>{
 const u=new URL(request.url),path=u.pathname,origin=trustedOrigin(d.env('APP_ORIGIN'));
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 const fail=(message:string,status=400)=>json({error:message},status);
 const redirect=(url:string,cookies:string[]=[])=>{const h=new Headers({'Location':url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});cookies.forEach(v=>h.append('Set-Cookie',v));return new Response(null,{status:303,headers:h})};
 const configured=!!origin&&readiness(d.env).database;
 const loginReady=configured&&d.env('KAKAO_LOGIN_ENABLED')==='true'&&!!d.env('KAKAO_REST_API_KEY')&&!!d.env('KAKAO_CLIENT_SECRET');
 const testPaymentReady=loginReady&&d.env('KAKAOPAY_TEST_ENABLED')==='true'&&!!d.env('KAKAOPAY_TEST_SECRET_KEY');
 const session=async()=>{const token=cookieValue(request,'__Host-sg-session');if(!token||!configured)return null;return (await d.query('SELECT a.id,a.nickname FROM sg_sessions s JOIN sg_accounts a ON a.id=s.account_id WHERE s.hash=$1 AND s.expires_at>now() AND a.deleted_at IS NULL',[hashToken(token)])).rows[0]||null};
 const pay=async(endpoint:string,body:unknown)=>{const r=await d.fetch('https://open-api.kakaopay.com/online/v1/payment/'+endpoint,{method:'POST',headers:{Authorization:'SECRET_KEY '+d.env('KAKAOPAY_TEST_SECRET_KEY'),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw Error('PAYMENT_PROVIDER');return r.json() as Promise<any>};
 try{
  if(request.method==='GET'&&path==='/api/account/config')return json({loginReady,testPaymentReady,checkoutReady:commercialCheckoutReady,trial:{images:trialImages,requiresCard:false,available:readiness(d.env).trialAvailable},plans,launchTarget:'2026-10-30',loginMessage:loginReady?'카카오로 시작하세요.':'카카오 로그인 연결을 준비하고 있어요. 지금은 카드 만들기를 먼저 체험하세요.'});
  if(request.method==='POST'&&(!origin||u.origin!==origin||!allowedOrigin(request,origin)))return fail('이 앱 화면에서 다시 시도해주세요.',403);
  if(request.method==='GET'&&path==='/api/auth/kakao/start'){
   if(!loginReady||u.origin!==origin)return fail('카카오 로그인 연결을 준비하고 있어요.',503);
   const token=randomToken();await d.query('DELETE FROM sg_oauth_states WHERE expires_at<=now()');await d.query("INSERT INTO sg_oauth_states(hash,expires_at) VALUES($1,now()+interval '10 minutes')",[hashToken(token)]);
   const url=new URL('https://kauth.kakao.com/oauth/authorize');url.search=new URLSearchParams({client_id:d.env('KAKAO_REST_API_KEY')!,redirect_uri:origin+'/api/auth/kakao/callback',response_type:'code',state:token}).toString();
   return redirect(url.href,[cookie('__Host-sg-oauth',token,600)]);
  }
  if(request.method==='GET'&&path==='/api/auth/kakao/callback'){
   if(!loginReady||u.origin!==origin)return fail('카카오 로그인 연결을 준비하고 있어요.',503);
   const state=u.searchParams.get('state')||'',saved=cookieValue(request,'__Host-sg-oauth'),clear=cookie('__Host-sg-oauth','',0);
   if(!same(saved,state))return redirect(origin+'/?account=login-failed',[clear]);
   const used=await d.query('DELETE FROM sg_oauth_states WHERE hash=$1 AND expires_at>now() RETURNING hash',[hashToken(state)]);
   if(!used.rows.length||u.searchParams.has('error')||!u.searchParams.get('code'))return redirect(origin+'/?account=login-cancelled',[clear]);
   const response=await d.fetch('https://kauth.kakao.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams({grant_type:'authorization_code',client_id:d.env('KAKAO_REST_API_KEY')!,client_secret:d.env('KAKAO_CLIENT_SECRET')!,redirect_uri:origin+'/api/auth/kakao/callback',code:u.searchParams.get('code')!}),signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)return redirect(origin+'/?account=login-failed',[clear]);const token:any=await response.json();if(typeof token.access_token!=='string')return redirect(origin+'/?account=login-failed',[clear]);
   const profileResponse=await d.fetch('https://kapi.kakao.com/v2/user/me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000),redirect:'error'});if(!profileResponse.ok)return redirect(origin+'/?account=login-failed',[clear]);const profile:any=await profileResponse.json();
   if(!Number.isSafeInteger(profile.id)||profile.id<=0)return redirect(origin+'/?account=login-failed',[clear]);
   const nickname=typeof profile.properties?.nickname==='string'?profile.properties.nickname.slice(0,40):'시니어그램 회원';
   const account=(await d.query('INSERT INTO sg_accounts(id,kakao_id,nickname) VALUES($1,$2,$3) ON CONFLICT(kakao_id) DO UPDATE SET nickname=EXCLUDED.nickname RETURNING id',[randomUUID(),String(profile.id),nickname])).rows[0];
   const sessionToken=randomToken();await d.query("INSERT INTO sg_sessions(hash,account_id,expires_at) VALUES($1,$2,now()+interval '30 days')",[hashToken(sessionToken),account.id]);
   return redirect(origin+'/?account=welcome',[clear,cookie('__Host-sg-session',sessionToken,2592000)]);
  }
  if(request.method==='GET'&&path==='/api/account/me'){
   const account=await session();if(!account)return json({user:null});
   const credits=await usage(d.query,account.id);
   const trialPeriods=credits.periods.filter(p=>p.source==='trial');
   return json({user:account,trial:credits.trialClaimed?{imagesRemaining:trialPeriods.reduce((n,p)=>n+p.image_limit-p.image_used,0)}:null,usage:credits,subscription:{active:credits.periods.some(p=>['google-play','kakaopay'].includes(p.source))},checkoutReady:false});
  }
  if(request.method==='POST'&&path==='/api/auth/logout'){
   const token=cookieValue(request,'__Host-sg-session');if(token&&configured)await d.query('DELETE FROM sg_sessions WHERE hash=$1',[hashToken(token)]);const r=json({ok:true});r.headers.set('Set-Cookie',cookie('__Host-sg-session','',0));return r;
  }
  if(path==='/api/account/trial'&&request.method==='POST'){
   const account=await session();if(!account)return fail('먼저 카카오로 로그인해주세요.',401);
   // No claim until the corresponding Netlify AI generation path is ready.
   return fail('AI 그림 체험 연결을 준비하고 있어요. 예시 카드는 바로 만들 수 있습니다.',503);
  }
  if(path==='/api/billing/checkout'&&request.method==='POST'){
   // A real subscription must not sell access before creation, renewal,
   // cancellation, refund and reconciliation have passed live acceptance tests.
   return fail('구독 판매 준비 중입니다. 지금은 결제되지 않습니다.',503);
  }
  if(path==='/api/billing/test-ready'&&request.method==='POST'){
   if(!testPaymentReady)return fail('카카오페이 테스트 연결을 준비하고 있어요.',503);
   const account=await session();if(!account)return fail('로그인해주세요.',401);const body=await readBody(request),plan=planFor(body.planId);
   if(!plan||!/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(body.requestId)||body.testConsent!==true)return fail('테스트 요금제와 동의 내용을 확인해주세요.');
   const id=randomUUID();const claim=await d.query("INSERT INTO sg_subscription_orders(id,account_id,request_id,plan_id,amount,state) VALUES($1,$2,$3,$4,$5,'preparing') ON CONFLICT(account_id,request_id) DO NOTHING RETURNING id",[id,account.id,body.requestId,plan.id,plan.price]);
   if(!claim.rows.length){const previous=(await d.query('SELECT state,redirect_url FROM sg_subscription_orders WHERE account_id=$1 AND request_id=$2',[account.id,body.requestId])).rows[0];return json({state:previous.state,url:previous.state==='ready'?previous.redirect_url:null},202)}
   try{
    const result=await pay('ready',{cid:'TCSUBSCRIP',partner_order_id:id,partner_user_id:account.id,item_name:'시니어그램 '+plan.name+' 테스트',quantity:1,total_amount:plan.price,tax_free_amount:0,approval_url:origin+'/api/billing/test-approve?order='+id,cancel_url:origin+'/?account=payment-cancelled',fail_url:origin+'/?account=payment-failed'});
    const url=safePaymentURL(body.mobile===true?result.next_redirect_mobile_url:result.next_redirect_pc_url);if(!url||typeof result.tid!=='string')throw Error('UNSAFE_PAYMENT_RESPONSE');
    await d.query("UPDATE sg_subscription_orders SET state='ready',tid=$1,redirect_url=$2 WHERE id=$3",[result.tid,url,id]);return json({state:'ready',url,testOnly:true});
   }catch{await d.query("UPDATE sg_subscription_orders SET state='unknown' WHERE id=$1",[id]);return fail('테스트 결제 접수 여부를 확인해야 합니다. 자동으로 다시 요청하지 않습니다.',502)}
  }
  if(path==='/api/billing/test-approve'&&request.method==='GET'){
   if(!testPaymentReady||u.origin!==origin)return fail('테스트 결제 연결이 꺼져 있어요.',503);
   const account=await session();if(!account)return fail('로그인 후 결제 결과를 확인해주세요.',401);const id=u.searchParams.get('order'),pg=u.searchParams.get('pg_token');if(!id||!pg)return fail('결제 확인 정보가 없습니다.');
   const claimed=await d.query("UPDATE sg_subscription_orders SET state='approving' WHERE id=$1 AND account_id=$2 AND state='ready' AND created_at>now()-interval '15 minutes' RETURNING *",[id,account.id]);
   if(!claimed.rows.length)return redirect(origin+'/?account=payment-check');const order=claimed.rows[0];
   try{const result=await pay('approve',{cid:'TCSUBSCRIP',tid:order.tid,partner_order_id:order.id,partner_user_id:account.id,pg_token:pg});if(!verifyPayment(result,order,'TCSUBSCRIP'))throw Error('PAYMENT_MISMATCH');await d.query("UPDATE sg_subscription_orders SET state='verified-test' WHERE id=$1",[id]);return redirect(origin+'/?account=payment-tested')}
   catch{await d.query("UPDATE sg_subscription_orders SET state='unknown' WHERE id=$1",[id]);return redirect(origin+'/?account=payment-check')}
  }
  return fail('요청한 기능을 찾을 수 없어요.',404);
 }catch{
  if(path==='/api/auth/kakao/callback'&&origin)return redirect(origin+'/?account=login-failed',[cookie('__Host-sg-oauth','',0)]);
  return fail('연결을 마치지 못했어요. 잠시 후 다시 시도해주세요.',503);
 }
}
