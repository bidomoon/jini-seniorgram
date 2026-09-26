import { cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
const out=new URL('../netlify-dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(new URL('../public/studio/',import.meta.url),out,{recursive:true});
const html=await readFile(new URL('index.html',out),'utf8');
await writeFile(new URL('index.html',out),html.replace('<main id="app">','<aside class="netlify-notice" style="max-width:1168px;margin:12px auto;padding:16px;background:#eef5f2;border-radius:12px"><b>카드 만들기 체험판</b><p>예시 카드·내 사진·영상 카드·음성 입력을 이용할 수 있어요. AI 생성·계정 보관함·우리 피드는 서버 연결을 준비하고 있습니다.</p><a href="https://maeum-card.jinimarketing.chatgpt.site" target="_blank" rel="noopener">기존 시험 운영 앱 열기 (접근 권한 필요)</a></aside><main id="app">'));
await writeFile(new URL('backend-status.json',out),JSON.stringify({imageReady:false,videoReady:false,communityReady:false,remaining:0,liveApiVerified:false,deployment:'netlify-preview'}));
await writeFile(new URL('backend-unavailable.json',out),JSON.stringify({error:'이 체험판은 서버 연결을 준비하고 있어요. 예시 카드·내 사진·영상 카드는 지금 만들 수 있습니다.'}));
await writeFile(new URL('_redirects',out),'/studio/* /:splat 301\n/api/sg/status /backend-status.json 200\n/api/sg/* /backend-unavailable.json 404\n/signin-with-chatgpt / 302\n');
await writeFile(new URL('_headers',out),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/backend-status.json\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n/backend-unavailable.json\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: no-store\n');
console.log('Netlify preview built: local card/voice tools; AI and account server explicitly unavailable.');

// The Netlify build serves the app at the origin root, unlike the Sites /studio path.
const manifest=JSON.parse(await readFile(new URL("manifest.webmanifest",out),"utf8"));
Object.assign(manifest,{id:"/",start_url:"/",scope:"/"});
await writeFile(new URL("manifest.webmanifest",out),JSON.stringify(manifest));
