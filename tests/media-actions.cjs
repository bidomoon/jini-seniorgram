// Native share and file pickers are mocked; no real file write or external send.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
function setup(){
 const {window,document}=parseHTML('<html><body><p id="status"></p></body></html>'),navigator={};let created=0,revoked=0;
 window.showSaveFilePicker=undefined;window.isSecureContext=true;
 const create=document.createElement.bind(document);document.createElement=tag=>{const el=create(tag);if(tag==='dialog'){el.showModal=()=>{el.open=true};el.close=()=>{if(!el.open)return;el.open=false;el.dispatchEvent(new window.Event('close'))}}return el};
 vm.runInNewContext(fs.readFileSync('public/studio/media-actions.js','utf8'),{window,document,navigator,Blob,File,URL:{createObjectURL:()=>`blob:test-${++created}`,revokeObjectURL:()=>revoked++},Error,String});
 return {window,document,navigator,media:window.seniorgramMedia,status:document.querySelector('#status'),urls:()=>({created,revoked})};
}
const png=new Blob(['png-content'],{type:'image/png'}),tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const a=setup();assert.equal(await a.media.share(new Blob(['bad'],{type:'text/html'}),'a.html',a.status),'invalid');assert.equal(await a.media.share(png,'카드.png',a.status),'unsupported');assert.match(a.status.textContent,/파일로 저장/);
 let release,calls=0,shared;
 a.navigator.canShare=()=>true;a.navigator.share=data=>{calls++;shared=data;return new Promise(r=>release=r)};
 const first=a.media.share(png,'../../<unsafe>.html',a.status);assert.equal(calls,1,'share is invoked immediately inside the button gesture');assert.equal(await a.media.share(png,'again.png',a.status),'busy');release();assert.equal(await first,'selected');assert.equal(calls,1);assert(shared.files[0].name.endsWith('.png'));assert(!/[<>/\\]/.test(shared.files[0].name));assert.match(a.status.textContent,/전송 결과는 선택한 앱/);
 a.navigator.share=async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'})};assert.equal(await a.media.share(png,'a',a.status),'cancelled');assert.match(a.status.textContent,/취소/);
 a.navigator.canShare=()=>{throw Error('provider failure')};assert.equal(await a.media.share(png,'a',a.status),'failed');
 const b=setup();let written=0,closed=0,releaseClose,pickerOptions;
 b.window.showSaveFilePicker=options=>{pickerOptions=options;return Promise.resolve({createWritable:async()=>({write:async blob=>{assert.equal(blob,png);written++},close:()=>new Promise(r=>releaseClose=()=>{closed++;r()}),abort:async()=>{}})})};
 const saving=b.media.chooseFile(png,'생일.jpg',b.status);await tick();assert.equal(written,1);assert.equal(closed,0);assert(!b.status.textContent.includes('저장했어요'),'completion waits for durable close');assert.equal(pickerOptions.suggestedName,'생일.png');releaseClose();assert.equal(await saving,'saved');assert.match(b.status.textContent,/선택한 위치에 파일을 저장/);
 let aborted=0;b.window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{throw Error('disk full')},close:async()=>{throw Error('must not close')},abort:async()=>{aborted++}})});assert.equal(await b.media.chooseFile(png,'a',b.status),'failed');assert.equal(aborted,1);assert.match(b.status.textContent,/저장하지 못/);
 b.window.showSaveFilePicker=async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'})};assert.equal(await b.media.chooseFile(png,'a',b.status),'cancelled');
 const c=setup();let releasePicker,writes=0;c.window.showSaveFilePicker=()=>new Promise(resolve=>releasePicker=resolve);const pending=c.media.chooseFile(png,'a',c.status);c.media.cleanup();releasePicker({createWritable:async()=>{writes++;return {}}});assert.equal(await pending,'cancelled');assert.equal(writes,0,'navigation cancels stale picker before a write');
 const d=setup(),dialog=d.media.openSave(png,'카드.png');assert(dialog.open);assert.equal(dialog.querySelector('[data-pick]').hidden,true);dialog.querySelector('[data-download]').onclick();assert.match(dialog.querySelector('[data-status]').textContent,/저장.*요청/);assert(!dialog.querySelector('[data-status]').textContent.includes('저장했어요'));dialog.querySelector('[data-close]').onclick();assert.deepEqual(d.urls(),{created:1,revoked:1});
 assert.equal(d.media.openSave(new Blob(['html'],{type:'text/html'}),'evil'),null);
 console.log('PASS media actions: safe filenames/type bounds, no duplicated native operation, share cancel/failure/delivery wording, picker write/close, failure abort, stale picker cancellation, accurate download-request notice, preview URL cleanup. Native APIs mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
