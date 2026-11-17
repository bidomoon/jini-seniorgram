// Event-level SpeechRecognition fixtures. These are not real spoken-audio tests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup({supported=true,constructorFails=false,startFails=false,starts=true}={}){
 const nodes=new Map(),timers=new Map(),events=new Map();let serial=0,last,created=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,checked:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},focus(){},append(){},before(){},dispatchEvent(){},scrollIntoView(){}});return nodes.get(id)};
 class Recognition{constructor(){if(constructorFails)throw Error('unsupported');last=this}start(){if(startFails)throw Error('start');if(starts)this.onstart?.()}abort(){this.aborted=true}}
 const doc={body:{append(){}},hidden:false,createElement:()=>node('panel'),getElementById:node,querySelector:s=>s==='#app'?node('app'):s==='#ai-prompt'?node('prompt'):s==='#ai-generate'?node('generate'):null,addEventListener:(name,fn)=>events.set('doc:'+name,fn)};
 const window={SpeechRecognition:supported?Recognition:undefined,addEventListener:(name,fn)=>events.set(name,fn)};
 const ctx={page:'home',busy:false,recording:false,readCardLocal:()=>({}),jobDraftKey:k=>k,setPage(p){ctx.page=p},openOccasion(id){ctx.page='edit';ctx.occasion=id}};
 node('generate').click=()=>{created++;ctx.busy=true};
 vm.runInNewContext(fs.readFileSync('public/studio/voice.js','utf8'),{window,document:doc,Event:class{},setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial},clearTimeout:id=>timers.delete(id)});
 window.initSeniorgramVoice(ctx);
 const transcript=(text,final=true)=>{last.onresult({results:[Object.assign([{transcript:text}],{isFinal:final})]})};
 return {node,ctx,doc,last:()=>last,created:()=>created,start:()=>node('voice-start').onclick(),transcript,timers,events,window};
}
(async()=>{
 const silent=setup();silent.start();assert.equal(silent.node('voice-confirm').disabled,true);silent.last().onend();assert.match(silent.node('command-voice-status').textContent,/말소리를 듣지 못/);assert.equal(silent.node('voice-start').attrs['aria-pressed'],'false');assert.equal(silent.timers.size,0);
 for(const error of ['not-allowed','service-not-allowed','no-speech','audio-capture','network','aborted','other']){
  const app=setup();app.start();const end=app.last().onend;app.last().onerror({error});const status=app.node('command-voice-status').textContent;end();assert.equal(app.node('command-voice-status').textContent,status,'late end must not erase actionable error');assert.equal(app.node('voice-start').attrs['aria-pressed'],'false');assert.equal(app.created(),0);assert.equal(app.timers.size,0);
 }
 for(const opts of [{constructorFails:true},{startFails:true}]){const app=setup(opts);app.start();assert.match(app.node('command-voice-status').textContent,/시작하지 못/);assert.equal(app.timers.size,0);assert.equal(app.node('voice-start').attrs['aria-pressed'],'false')}
 const stalled=setup({starts:false});stalled.start();assert.equal(stalled.timers.size,1);[...stalled.timers.values()][0].fn();assert.match(stalled.node('command-voice-status').textContent,/마이크 응답/);assert.equal(stalled.node('voice-start').attrs['aria-pressed'],'false');
 const partial=setup();partial.start();partial.transcript('손녀 생일 카드 만들어줘',false);const oldResult=partial.last().onresult,oldStart=partial.last().onstart;await partial.node('voice-confirm').onclick();assert.equal(partial.ctx.page,'home','confirmation while listening cannot execute');partial.start();assert.equal(partial.node('voice-review').hidden,false);await partial.node('voice-confirm').onclick();assert.equal(partial.ctx.occasion,'grandchild');const status=partial.node('command-voice-status').textContent;oldStart();oldResult({results:[]});assert.equal(partial.node('command-voice-status').textContent,status,'aborted callbacks cannot resurrect listening');
 const limit=setup();limit.start();limit.transcript('가'.repeat(1000));limit.last().onend();assert.equal(limit.node('voice-text').value.length,800);
 const hidden=setup();hidden.start();hidden.doc.hidden=true;hidden.events.get('doc:visibilitychange')();assert.equal(hidden.node('voice-start').attrs['aria-pressed'],'false');assert.equal(hidden.last().onresult,null);
 const unsupported=setup({supported:false});unsupported.start();assert.equal(unsupported.node('voice-review').hidden,false);assert.match(unsupported.node('command-voice-status').textContent,/지원하지 않/);
 const nav=setup();nav.node('voice-type').onclick();nav.events.get('sg-page-changed')();assert.equal(nav.node('voice-review').hidden,true,'manual navigation clears stale review');
 const paid=setup();paid.node('voice-type').onclick();paid.node('voice-text').value='꽃밭을 그려줘';paid.node('voice-text').oninput();paid.node('generate').disabled=true;await paid.node('voice-confirm').onclick();assert.equal(paid.created(),0);assert.equal(paid.node('voice-next').hidden,false);assert(!paid.node('command-voice-status').textContent.includes('요청을 보냈어요'));
 paid.node('generate').disabled=false;await paid.node('voice-confirm').onclick();assert.equal(paid.created(),1);paid.ctx.busy=false;await paid.node('voice-confirm').onclick();assert.equal(paid.created(),1,'successful confirmation is consumed even after busy clears');
 console.log('PASS voice states: silent end, permission/network/device errors, startup failure/watchdog, manual stop/interim review, stale callbacks, hidden page, unsupported browsers, 800-char bound, stale navigation and no paid action without readiness/confirmation. Recognition is simulated.');
})().catch(error=>{console.error(error);process.exitCode=1});
