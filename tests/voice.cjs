const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,checked:false,setAttribute(){},focus(){},before(){},dispatchEvent(){},click(){this.onclick?.()}});return nodes.get(id)}
let made=0,shared=0,lastRecognition;const doc={createElement:()=>node('panel'),getElementById:node,querySelector:s=>s==='#app'?node('app'):s==='#ai-prompt'?node('prompt'):s==='#ai-generate'?node('generate'):s==='#ai-result video,#ai-result img'?{src:'https://local.test/image',tagName:'IMG'}:null,addEventListener(){}};
class Recognition{constructor(){lastRecognition=this}start(){this.onstart?.()}abort(){}stop(){this.onend?.()}}
const window={SpeechRecognition:Recognition,addEventListener(){}};const sandbox={window,document:doc,SpeechSynthesisUtterance:class{},setTimeout:()=>1,clearTimeout(){},Event:class{},fetch:async()=>({ok:true,blob:async()=>({size:12})})};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('public/studio/voice.js','utf8'),sandbox);
const ctx={busy:false,recording:false,page:'ai-image',readCardLocal:()=>({}),jobDraftKey:k=>k,setPage(p){ctx.page=p},sharingDialog(){shared++},shareChannels:{instagram:{name:'인스타그램'}}};window.initSeniorgramVoice(ctx);node('generate').onclick=()=>{made++;ctx.busy=true};const classify=window.seniorgramVoiceClassify;
for(const [s,k] of [['손자가 노는 그림 그려줘','image'],['졸업 축하 카드 만들어줘','card'],['내 사진으로 영상 카드 만들어줘','video'],['AI로 생일 카드 그려줘','image'],['생일 카드를 카톡으로 보내줘','share'],['꽃밭 동영상 만들어줘','video'],['인스타에 올려줘','share'],['인스타에 올릴 그림 만들어줘','image'],['꽃을 더 많이 넣어줘','edit'],['내 작품 보여줘','gallery'],['만들지 말아줘','cancel']])assert.equal(classify(s).kind,k,s);
function speak(text){node('voice-start').onclick();const r=lastRecognition;r.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});r.onend()}
(async()=>{let opened=[];
ctx.openOccasion=id=>opened.push(id);
speak('졸업 축하 카드 만들어줘');
assert.equal(opened.length,0);
await node('voice-confirm').onclick();
assert.deepEqual(opened,['school']);
node('voice-type').onclick();
await node('voice-confirm').onclick();
assert.equal(made,0,'blank input never creates a job');
node('voice-text').value='손녀 생일 카드 만들어줘';
await node('voice-confirm').onclick();
assert.deepEqual(opened,['school','grandchild']);
speak('카드 만들어줘');
await node('voice-confirm').onclick();
assert.equal(ctx.page,'templates');
assert.equal(made,0,'free cards do not submit AI jobs');
speak('꽃밭을 그려줘');assert.equal(made,0,'dictation does not spend without confirmation');await node('voice-confirm').onclick();assert.equal(made,1);assert.equal(node('prompt').value,'꽃밭을 그려줘');await node('voice-confirm').onclick();assert.equal(made,1,'no duplicate creation');ctx.busy=false;speak('인스타에 올려줘');await node('voice-confirm').onclick();assert.equal(shared,1);assert.match(node('command-voice-status').textContent,/아직 게시되지는/);speak('강아지 그려줘');node('voice-cancel').onclick();await node('voice-confirm').onclick();assert.equal(made,1);node('voice-start').onclick();const stale=lastRecognition;node('voice-start').onclick();assert.equal(stale.onend,null,'stopped recognizer cannot replay');console.log('Voice routing, confirmation, shared application state, sharing handoff, cancellation passed');})();
