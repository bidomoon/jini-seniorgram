import {JWT,OAuth2Client} from 'google-auth-library';
import type {Dependencies} from '../product/types';
export type PlayProvider = {
 get:(packageName:string,token:string)=>Promise<any>;
 acknowledge:(packageName:string,product:string,token:string)=>Promise<void>;
 verifyPush:(jwt:string,audience:string,email:string)=>Promise<boolean>;
};
// One scoped identity for Play Developer API only. Credentials never enter a DTO/log.
export function googlePlayProvider(d:Pick<Dependencies,'env'|'fetch'|'playCredentials'>):PlayProvider {
 let client:JWT|undefined;
 async function identity(){
  if(!client){const credentials=await d.playCredentials?.();if(!credentials)throw Error('PLAY_CREDENTIALS_UNAVAILABLE');client=new JWT({email:credentials.email,key:credentials.privateKey,scopes:['https://www.googleapis.com/auth/androidpublisher'],transporterOptions:{timeout:10000,retry:false}})}
  return client;
 }
 const verifier=new OAuth2Client({transporterOptions:{timeout:10000,retry:false}});
 async function call(path:string,method='GET'){
  const auth=await (await identity()).getAccessToken();if(!auth.token)throw Error('PLAY_AUTH_UNAVAILABLE');
  const response=await d.fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+path,{method,headers:{Authorization:'Bearer '+auth.token,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?'{}':undefined,signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error('PLAY_PROVIDER_UNAVAILABLE');
  return method==='GET'?response.json():undefined;
 }
 return {
  get:(pkg,token)=>call(encodeURIComponent(pkg)+'/purchases/subscriptionsv2/tokens/'+encodeURIComponent(token)),
  acknowledge:async(pkg,product,token)=>{await call(encodeURIComponent(pkg)+'/purchases/subscriptions/'+encodeURIComponent(product)+'/tokens/'+encodeURIComponent(token)+':acknowledge','POST')},
  verifyPush:async(jwt,audience,email)=>{
   try{const ticket=await verifier.verifyIdToken({idToken:jwt,audience});const payload=ticket.getPayload();return !!payload&&payload.email_verified===true&&payload.email===email&&['accounts.google.com','https://accounts.google.com'].includes(payload.iss)}catch{return false}
  }
 };
}
