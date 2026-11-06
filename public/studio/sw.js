const CACHE='seniorgram-shell-v19';
const FILES=['./offline.html','./style.css?v=19','./assets/icon-192.png'];
const PUBLIC_FILES=new Set(FILES.map(path=>new URL(path,self.location.href).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('message',event=>{if(event.data?.type==='SG_ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('seniorgram-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))return;
 // Never cache account responses, OAuth redirects, private media or navigation HTML.
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('./offline.html')));
 else if(PUBLIC_FILES.has(url.href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
