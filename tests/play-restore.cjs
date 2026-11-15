const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const source=fs.readFileSync('public/studio/play-billing.js','utf8');
function setup({ready=true,user=true,service=true}={}){
 const {window,document}=parseHTML('<html><body></body></html>');const create=document.createElement.bind(document);document.createElement=tag=>{const el=create(tag);if(tag==='dialog'){el.showModal=()=>{};el.close=()=>el.dispatchEvent(new window.Event('close'))}return el};
 let refresh=0,lookups=0;const requests=[];const privateToken='token-must-never-enter-dom-1234';
 window.seniorgramAccount={refresh:async()=>{refresh++},open(){}};
 window.getDigitalGoodsService=undefined;
 if(service)window.getDigitalGoodsService=async()=>({listPurchases:async()=>{lookups++;return [{itemId:'image-monthly',purchaseToken:privateToken},{itemId:'another-app-product',purchaseToken:'unrelated'}]}});
 const fetch=async(url,options)=>{requests.push({url,options});let body;if(url.endsWith('/config'))body={ready,live:false,products:[{id:'image',product:'image-monthly'}]};else if(url.endsWith('/me'))body={user:user?{id:'one'}:null};else if(url.endsWith('/verify'))body={purchase:{active:true}};else if(url.endsWith('/sync'))body={purchases:[]};else throw Error('unexpected endpoint');return {ok:true,json:async()=>body}};
 vm.runInNewContext(source,{window,document,fetch,Set,Error,JSON,PaymentRequest:class{constructor(){throw Error('Restoration must not initiate a payment')}},localStorage:{setItem(){throw Error('Never persist purchase tokens in localStorage')}}});
 return {window,document,requests,counts:()=>({refresh,lookups}),privateToken};
}
(async()=>{
 const off=setup({ready:false});await off.window.seniorgramPlay.open();assert.match(off.document.body.textContent,/준비/);assert.equal(off.counts().lookups,0);assert.equal(off.requests.length,1);
 const guest=setup({user:false});await guest.window.seniorgramPlay.open();assert(guest.document.querySelector('[data-login]'));assert.equal(guest.counts().lookups,0);
 const browser=setup({service:false});await browser.window.seniorgramPlay.open();assert.equal(browser.document.querySelector('[data-restore]').disabled,true,'ordinary browsers cannot pretend to restore native purchases');
 const app=setup();await app.window.seniorgramPlay.open();const restore=app.document.querySelector('[data-restore]');await restore.onclick();assert.equal(app.counts().lookups,0,'explicit account binding consent is required');
 app.document.querySelector('[data-consent]').checked=true;await Promise.all([restore.onclick(),restore.onclick()]);assert.equal(app.counts().lookups,1,'duplicate taps are ignored');assert.equal(app.requests.filter(r=>r.url.endsWith('/verify')).length,1,'only own configured products are restored');assert.equal(app.counts().refresh,1);assert.match(app.document.querySelector('[data-status]').textContent,/복원했어요/);assert(!app.document.body.innerHTML.includes(app.privateToken));
 await app.document.querySelector('[data-sync]').onclick();assert.match(app.document.querySelector('[data-status]').textContent,/이용 가능한 연결 구독이 없/);
 console.log('PASS Play restore UI: closed setup, login, native-service detection, explicit account consent, duplicate taps, product filtering, no token in DOM/storage, no new purchase, account refresh. Native Google Play is mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
