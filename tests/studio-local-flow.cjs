// Exercise the real card → keep → gallery → reopen flow. Canvas pixels and device APIs
// are stubbed here; this is not a screenshot, microphone or physical-phone test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom'),{IDBFactory}=require('fake-indexeddb'),{randomUUID}=require('node:crypto');
const {window,document}=parseHTML(fs.readFileSync('public/studio/index.html','utf8'));
let objectURLs=0;
const ctx=new Proxy({measureText:text=>({width:String(text).length*18}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{})});
window.HTMLCanvasElement.prototype.getContext=()=>ctx;
window.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new Blob(['test-png-bytes'],{type:'image/png'}))};
window.HTMLElement.prototype.focus=()=>{};
const create=document.createElement.bind(document);
document.createElement=tag=>{const el=create(tag);if(tag==='dialog'){el.showModal=()=>{el.open=true};el.close=()=>{el.open=false;el.dispatchEvent(new window.Event('close'))}}return el};
class Image{constructor(){this.complete=true;this.naturalWidth=this.width=900;this.naturalHeight=this.height=900}set src(v){this._src=v;queueMicrotask(()=>this.onload?.())}get src(){return this._src}}
const storage=new Map();const location=new URL('https://jini-seniorgram.netlify.app/');
const history={state:null,replaceState(state){this.state=state},pushState(state){this.state=state}};
const navigator={};window.indexedDB=new IDBFactory();window.scrollTo=()=>{};
const sandbox={window,document,location,history,navigator,Image,HTMLCanvasElement:window.HTMLCanvasElement,Blob,File,URL:Object.assign(class extends URL{}, {createObjectURL:()=>`blob:local-${++objectURLs}`,revokeObjectURL(){}}),Event:window.Event,crypto:{randomUUID},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn,t)=>{const timer=setTimeout(fn,t);timer.unref();return timer},clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},fetch:async()=>({ok:true,json:async()=>({database:false,imageReady:false})}),performance,console};
const context=vm.createContext(sandbox);
for(const file of ['catalog','navigation','media-actions','local-works','voice','membership','app','learn'])vm.runInContext(fs.readFileSync('public/studio/'+file+'.js','utf8'),context,{filename:file+'.js'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick()}assert.fail('UI did not settle')}
(async()=>{
 await until(()=>document.querySelector('[data-ready-label]')?.textContent==='연결 준비 중');
 assert.equal(document.querySelector('#nav-create').getAttribute('aria-current'),'page');
 assert([...document.querySelectorAll('[data-ready]')].every(b=>b.disabled),'unavailable AI/feed cannot be entered from home');
 assert.equal(document.querySelector('#app button').textContent.trim(),'인사 카드 바로 만들기 →','usable creation comes first');
 assert(document.querySelector('.sg-voice-dock').hidden,'large voice controls do not obscure the first creation');
 await until(()=>document.querySelector('#sg-account-open')?.textContent==='이용 안내');
 assert(document.querySelector('#sg-plans-open').hidden,'unavailable checkout is not promoted at the top');
 document.querySelector('#home-photo').onclick();
 assert.equal(document.querySelector('#photo').closest('details').open,true,'photo entry opens the actual photo field');
 assert(!document.querySelector('#nav-gallery').hasAttribute('aria-current'));
 document.querySelector('#nav-create').onclick();
 document.querySelector('#home-voice').onclick();assert(document.querySelector('.sg-voice-dialog')?.open,'home voice control opens the real dialog');
 document.querySelector('.sg-voice-dialog>button').onclick();assert.equal(document.querySelector('.sg-voice-dialog'),null);
 document.querySelector('#nav-help').onclick();

 document.querySelector('#sg-learn-practice').onclick();
 assert.match(document.querySelector('#app h1').textContent,/생일 축하/,'lesson opens actual birthday practice');
 const name=document.querySelector('#recipient');name.value='테스트 친구';name.oninput({target:name});
 await document.querySelector('#card-form').onsubmit({preventDefault(){}});
 assert(document.querySelector('#keep-image'),'finished card has keep action');
 await until(()=>document.querySelector('#publish-community')?.hidden===true);
 assert(document.querySelector('#copy-art-link').hidden,'unpublished local work does not advertise a nonworking public link');
 assert(!document.querySelector('.sg-extra-share').open,'secondary channel choices do not crowd the primary save/share flow');
 await document.querySelector('#keep-image').onclick();
 await document.querySelector('#keep-image').onclick();
 assert.match(document.querySelector('#keep-image').textContent,/보관 완료/);
 document.querySelector('#nav-gallery').onclick();await until(()=>document.querySelector('[data-local-open]'));
 assert.equal(document.querySelectorAll('[data-local-open]').length,1,'repeat save is not duplicated');
 assert.match(document.querySelector('#my-jobs').textContent,/연결 준비 중/,'unconfigured server does not block local gallery');
 document.querySelector('[data-local-open]').onclick();await until(()=>document.querySelector('.sg-local-viewer'));
 assert(document.querySelector('.sg-local-viewer img'));
 document.querySelector('[data-close]').onclick();
 document.querySelector('[data-local-open]').onclick();await until(()=>document.querySelector('.sg-local-viewer'));
 window.seniorgramVoice.open();assert(document.querySelector('.sg-voice-dialog'),'voice controls can open above a work');
 document.querySelector('#voice-type').onclick();document.querySelector('#voice-text').value='내 작품에 보관해줘';document.querySelector('#voice-text').oninput();await document.querySelector('#voice-confirm').onclick();
 assert(document.querySelector('.sg-media-save'),'saved work voice save opens a gesture-based file help');assert.equal(document.querySelector('.sg-voice-dialog'),null,'voice dialog closes after handing off');assert(document.querySelector('.sg-voice-panel'),'one panel returns to its home');
 document.querySelector('.sg-media-save [data-close]').onclick();
 window.seniorgramVoice.open();document.querySelector('#voice-type').onclick();document.querySelector('#voice-text').value='카톡으로 보내줘';document.querySelector('#voice-text').oninput();await document.querySelector('#voice-confirm').onclick();
 assert.match(document.querySelector('#channel-dialog').textContent,/카카오톡/,'voice share uses the opened local file');assert.equal(document.querySelector('.sg-voice-dialog'),null);
 document.querySelector('#channel-close').onclick();assert(document.querySelector('.sg-local-viewer'),'shared-file preparation keeps the original viewer available');

 const store=window.createSeniorgramWorkStore();const records=await store.list();
 assert.equal(await (await store.get(records[0].id)).blob.text(),'test-png-bytes');await store.close();
 document.querySelector('#nav-create').onclick();assert.equal(document.querySelector('.sg-local-viewer'),null);
 // Run real voice-controller + card code together using typed recognition text.
 const request=async text=>{window.seniorgramVoice.open();document.querySelector('#voice-type').onclick();const input=document.querySelector('#voice-text');input.value=text;input.oninput();await document.querySelector('#voice-confirm').onclick()};
 await request('아침 인사 만들어줘');assert.match(document.querySelector('#app h1').textContent,/좋은 아침/,'everyday greeting opens a usable free card');
 await request('받는 이름을 서준으로 바꿔줘');assert.equal(document.querySelector('#recipient').value,'서준');
 await request('문구를 늘 건강하고 행복하세요로 바꿔줘');assert.equal(document.querySelector('#message').value,'늘 건강하고 행복하세요');
 await request('이대로 카드 완성해줘');assert(document.querySelector('#result-image'));
 await request('내 작품에 보관해줘');assert.match(document.querySelector('#keep-image').textContent,/보관 완료/);
 await request('내 작품 보여줘');await until(()=>document.querySelectorAll('[data-local-open]').length===2);
 await request('꽃밭을 그려줘');await until(()=>!document.querySelector('#ai-status')?.textContent.includes('확인하고'));
 assert.equal(document.querySelector('#voice-next').hidden,false,'closed AI leaves an actionable free-card alternative');
 assert(!document.querySelector('#command-voice-status').textContent.includes('요청을 보냈어요'));
 document.querySelector('#voice-card-fallback').onclick();assert(document.querySelector('[data-template]'));
 console.log('PASS voice-to-card integration: greeting → name/copy → finish → durable keep → gallery; unavailable AI → free-card recovery. Recognition text, Canvas and device APIs are mocked.');
 console.log('PASS first use: usable entry first, explicit unavailable-feature gates, direct photo controls, help navigation, modal voice access and local-only gallery.');
 console.log('PASS studio flow: lesson → edit → image export → keep → repeat keep → local gallery without login → reopen; actual photo/phone rendering not simulated.');
})().catch(error=>{console.error(error);process.exitCode=1});
