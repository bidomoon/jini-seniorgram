// Read-only deployment check. This never signs in, creates media or makes a payment.
const origin=new URL(process.env.APP_ORIGIN||'https://jini-seniorgram.netlify.app');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('APP_ORIGIN must be an HTTPS origin without credentials.');
async function read(path){
 try{
  const response=await fetch(new URL(path,origin),{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))return null;
  return await response.json();
 }catch{return null;}
}
const [account,status,links]=await Promise.all(['/api/account/config','/api/sg/status','/.well-known/assetlinks.json'].map(read));
const checks={
 api_reachable:!!account&&!!status,
 member_database:status?.database===true,
 kakao_login:account?.loginReady===true,
 member_storage:status?.storage===true,
 image_generation:status?.imageReady===true,
 image_trial:account?.trial?.available===true&&status?.trialAvailable===true,
 video_generation:status?.videoReady===true,
 community:status?.communityReady===true,
 subscription_sales:account?.checkoutReady===true,
 android_domain_verified:Array.isArray(links)&&links.some(link=>link.relation?.includes('delegate_permission/common.handle_all_urls')&&link.target?.namespace==='android_app'&&link.target?.package_name==='app.jininova.seniorgram'&&Array.isArray(link.target.sha256_cert_fingerprints)&&link.target.sha256_cert_fingerprints.length>0&&link.target.sha256_cert_fingerprints.every(x=>/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(x))),
};
const blocked=Object.entries(checks).filter(([,value])=>!value).map(([name])=>name);
console.log(JSON.stringify({checkedAt:new Date().toISOString(),origin:origin.origin,checks,blocked,scope:'Server configuration and Android domain file only. Physical-device tests, actual login, purchases and Play Console approval still require separate evidence.'},null,2));
if(!checks.api_reachable||(process.argv.includes('--require-ready')&&blocked.length))process.exitCode=1;
