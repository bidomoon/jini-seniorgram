import {mkdir,writeFile} from 'node:fs/promises';
const fingerprints=(process.env.ANDROID_APP_SIGNING_SHA256||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);
if(!fingerprints.length||fingerprints.some(x=>!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x)))throw Error('Set ANDROID_APP_SIGNING_SHA256 to the real Play App Signing certificate SHA-256, comma-separated if rotating. Never use a made-up fingerprint.');
const dir=new URL('../public/studio/.well-known/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('assetlinks.json',dir),JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'app.jininova.seniorgram',sha256_cert_fingerprints:fingerprints}}],null,2)+'\n');
console.log('Digital Asset Links generated for the supplied signing certificate.');
