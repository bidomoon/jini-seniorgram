import { cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
const out=new URL('../netlify-dist/',import.meta.url);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(new URL('../public/studio/',import.meta.url),out,{recursive:true});
const html=await readFile(new URL('index.html',out),'utf8');
await writeFile(new URL('index.html',out),html.replace('<head>','<head><meta name="seniorgram-platform" content="netlify">'));
await writeFile(new URL('_redirects',out),'/studio/* /:splat 301\n/signin-with-chatgpt /api/auth/kakao/start 302\n');
await writeFile(new URL('_headers',out),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n/sw.js\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n');
console.log('Netlify app built: Kakao account + gated AI, member gallery and community functions.');

// The Netlify build serves the app at the origin root, unlike the Sites /studio path.
const manifest=JSON.parse(await readFile(new URL("manifest.webmanifest",out),"utf8"));
Object.assign(manifest,{id:"/",start_url:"/",scope:"/"});
await writeFile(new URL("manifest.webmanifest",out),JSON.stringify(manifest));
