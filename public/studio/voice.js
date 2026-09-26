/* Voice commands reuse existing generation, permissions and sharing paths. */
window.initSeniorgramVoice=function(ctx){
 const panel=document.createElement('section');panel.className='sg-voice-panel';panel.setAttribute('aria-label','말로 만들기');
 panel.innerHTML='<div class="sg-voice-heading"><h2>말로 하기</h2><button type="button" class="primary" id="voice-start">🎤 말로 하기</button></div><p>“손자가 귀엽게 노는 그림 그려줘”, “졸업 축하 카드 만들어줘”</p><p id="command-voice-status" role="status" aria-live="polite">글로 입력하는 방법도 그대로 사용할 수 있어요.</p><div id="voice-review" hidden><label for="voice-text">이렇게 들었어요 · 잘못 들었다면 고쳐주세요</label><textarea id="voice-text" maxlength="800"></textarea><p id="voice-action"></p><div class="choices"><button class="primary" id="voice-confirm">이 내용으로 계속</button><button class="secondary" id="voice-cancel">취소</button></div></div><details><summary>음성 사용 안내</summary><p>말로 하기 버튼을 누르면 듣기를 시작해요. 말이 끝나거나 듣기 멈추기를 누르면 멈춥니다. 브라우저의 음성 인식 서비스로 목소리가 전송될 수 있습니다. 인식한 문장은 확인 후 만들기에 사용하며 AI 이용 횟수가 차감될 수 있습니다. 지원하지 않는 기기에서는 키보드의 마이크 또는 글 입력을 사용하세요.</p><label><input type="checkbox" id="voice-speak"> 안내를 소리로도 듣기</label><p>인스타그램·틱톡에 자동 게시하는 기능은 아직 연결되지 않았어요. 공유 준비 후 화면의 공유 버튼을 누르고 앱에서 게시를 마쳐주세요.</p></details>';
 document.querySelector('#app').before(panel);
 const el=id=>document.getElementById(id),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let recognition=null,listening=false,pending=null,executing=false,spoken='',timer,epoch=0;
 function say(text){el('command-voice-status').textContent=text;if(el('voice-speak').checked&&window.speechSynthesis&&!listening){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';speechSynthesis.speak(u)}}
 function classify(text){
  const t=text.trim(),compact=t.replace(/\s/g,'');
  if(/^(취소|그만|멈춰|멈춰줘)[.!?。]*$/.test(compact))return {kind:'cancel'};
  if(/^(네|예|응|좋아|확인|진행해|만들어줘|실행해)[.!?。]*$/.test(compact))return {kind:'confirm'};
  const channels=[['instagram',/인스타|instagram/i],['tiktok',/틱톡|tiktok/i],['kakao',/카카오|카톡/],['facebook',/페이스북|페북/],['sms',/문자/]];
  if(/하지\s*마|말아|취소해/.test(t))return {kind:'cancel'};
  const channel=channels.find(([,r])=>r.test(t));
  if(channel&&/올려|게시|보내|공유|업로드/.test(t)&&!/그려|만들|생성/.test(t))return {kind:'share',channel:channel[0]};
  if(/^(내\s*작품|보관함)(\s*(보여줘|열어줘|보기))?[.!?]*$/.test(t))return {kind:'gallery'};
  if(/수정|바꿔|더\s*(넣|많)|추가|빼줘|지워|변경/.test(t)&&!/새로운|새\s*그림/.test(t))return {kind:'edit',prompt:t};
  return {kind:/영상|동영상|비디오/.test(t)?'video':'image',prompt:t};
 }
 function review(text){pending=classify(text);if(pending.kind==='cancel'){cancel();return}if(pending.kind==='confirm'){pending=null;say('만들고 싶은 내용부터 말씀해주세요.');return}el('voice-text').value=text;el('voice-review').hidden=false;describe();say('들은 내용을 확인해주세요. 맞으면 계속 버튼을 누르거나 다시 마이크를 눌러 확인이라고 말씀하세요.');}
 function describe(){const c=classify(el('voice-text').value);el('voice-action').textContent=c.kind==='share'?'공유 준비 · 실제 게시 완료는 보내는 앱에서 확인해요.':c.kind==='edit'?'현재 선택한 AI 그림 수정':c.kind==='video'?'AI 영상 만들기 · 영상 연결이 완료된 경우 이용 가능':c.kind==='gallery'?'내 작품 보관함 열기':'AI 그림 만들기 · 생성 기능이 열려 있는 경우 이용 가능';}
 function cancel(){pending=null;el('voice-review').hidden=true;stop();say('음성 요청을 취소했어요. 이미 접수된 생성 작업은 취소되지 않습니다.');}
 function stop(){epoch++;spoken='';clearTimeout(timer);if(recognition){recognition.onend=null;recognition.onresult=null;recognition.onstart=null;recognition.onerror=null;try{recognition.abort()}catch{}recognition=null;}listening=false;el('voice-start').textContent='🎤 말로 하기';el('voice-start').setAttribute('aria-pressed','false');}
 async function execute(){
  if(executing||!pending)return;const command=classify(el('voice-text').value);if(command.kind==='cancel'){cancel();return}if(command.kind==='confirm'){say('만들고 싶은 내용을 적거나 말씀해주세요.');return}
  executing=true;el('voice-confirm').disabled=true;stop();
  try{
   if(ctx.busy||ctx.recording){say('지금 작업을 마친 뒤 다시 말씀해주세요.');return}
   if(command.kind==='gallery'){ctx.setPage('gallery');say('내 작품을 열었어요.');}
   else if(command.kind==='share'){
    const aiMedia=document.querySelector('#ai-result video,#ai-result img');let blob=null,name='시니어그램.png';
    if(aiMedia){say('완성 파일을 불러와 공유를 준비합니다.');const response=await fetch(aiMedia.src);if(!response.ok)throw Error('완성 파일을 불러오지 못했어요.');blob=await response.blob();if(aiMedia.tagName==='VIDEO')name='시니어그램.mp4';}
    else if(ctx.page==='result'){const isVideo=document.querySelector('#video-actions')&&!document.querySelector('#video-actions').hidden;blob=isVideo?ctx.videoBlob:ctx.pngBlob;name=isVideo?'시니어그램.'+ctx.videoExt:name;}
    if(!blob){say('보낼 작품을 먼저 완성하고 열어주세요. 내 작품에서도 선택할 수 있어요.');return}
    ctx.sharingDialog(command.channel,blob,name,ctx.currentPostId);say(ctx.shareChannels[command.channel].name+' 공유를 준비했어요. 휴대폰 공유창 열기 버튼을 누른 뒤 게시를 마쳐주세요. 아직 게시되지는 않았습니다.');
   }else{
    if(command.kind==='edit'){
     const edit=document.querySelector('#ai-edit');if(edit)edit.click();else if(!document.querySelector('#ai-unlink')){say('내 작품에서 수정할 AI 그림을 먼저 열어주세요.');return}
    }else{
     const target=command.kind==='video'?'ai-video':'ai-image';const saved=ctx.readCardLocal(ctx.jobDraftKey(command.kind==='video'?'video':'image'),{});
     if(saved?.requestId){say('이전에 접수한 작품이 있어요. 해당 만들기 화면에서 결과를 확인하고 새 요청 준비하기를 눌러주세요.');ctx.setPage(target);return}
     if(saved?.parentId){say('이전에 수정하던 그림이 있어요. 먼저 수정 화면에서 처음부터 새 그림 만들기를 선택해주세요.');ctx.setPage(target);return}
     if(ctx.page!==target)ctx.setPage(target);
    }
    const input=document.querySelector('#ai-prompt');if(!input||input.disabled){say('접수된 작업이 진행 중입니다. 내 작품에서 확인해주세요.');return}
    input.value=command.prompt;input.dispatchEvent(new Event('input',{bubbles:true}));
    const button=document.querySelector('#ai-generate');
    // Readiness can load asynchronously: never queue a hidden future paid action.
    if(button&&!button.disabled){button.click();say('만들기 요청을 보냈어요. 접수 여부와 진행 상황은 만들기 화면에서 확인해주세요.');}
    else say('말씀하신 내용을 입력했어요. 연결 상태 안내를 확인한 뒤 만들기 버튼을 누르거나, 마이크를 눌러 다시 확인이라고 말씀해주세요.');
   }
   if(command.kind==='share'||command.kind==='gallery'||document.querySelector('#ai-generate')?.disabled&&ctx.busy){pending=null;el('voice-review').hidden=true;}
  }catch(error){say(error.message||'처리하지 못했어요. 다시 시도해주세요.')}finally{executing=false;el('voice-confirm').disabled=false}
 }
 el('voice-text').oninput=describe;el('voice-confirm').onclick=execute;el('voice-cancel').onclick=cancel;
 el('voice-start').onclick=()=>{
  if(listening){const text=spoken;stop();if(text)review(text);else say('듣기를 멈췄어요.');return}
  if(!Recognition){say('이 브라우저에서는 직접 음성 인식을 지원하지 않아요. 아래 칸을 누르고 휴대폰 키보드의 마이크로 말씀하거나 글로 적어주세요.');pending={kind:'image'};el('voice-review').hidden=false;el('voice-text').focus();return}
  if(ctx.recording||ctx.busy||executing){say('현재 녹음이나 접수를 마친 뒤 말씀해주세요.');return}
  window.speechSynthesis?.cancel();spoken='';listening=true;const run=++epoch;recognition=new Recognition();recognition.lang='ko-KR';recognition.interimResults=true;recognition.continuous=false;
  recognition.onstart=()=>{listening=true;el('voice-start').textContent='■ 듣기 멈추기';el('voice-start').setAttribute('aria-pressed','true');el('command-voice-status').textContent='듣고 있어요. 천천히 말씀해주세요.';timer=setTimeout(()=>recognition?.stop(),45000)};
  recognition.onresult=e=>{let final='';let partial='';for(let i=0;i<e.results.length;i++){partial+=e.results[i][0].transcript;if(e.results[i].isFinal)final+=e.results[i][0].transcript}el('command-voice-status').textContent='듣고 있어요: '+partial;spoken=final||partial;};
  recognition.onerror=e=>{spoken='';say(({ 'not-allowed':'마이크 사용을 허용해주세요. 글 입력은 계속 사용할 수 있어요.','no-speech':'목소리를 듣지 못했어요. 마이크를 눌러 다시 말씀해주세요.',network:'음성 인식 연결이 끊겼어요. 인터넷을 확인하거나 글로 입력해주세요.','audio-capture':'마이크를 찾지 못했어요. 마이크 연결을 확인해주세요.'})[e.error]||'음성 인식을 마쳤어요. 다시 말하거나 글로 입력해주세요.');};
  recognition.onend=()=>{if(run!==epoch)return;clearTimeout(timer);listening=false;el('voice-start').textContent='🎤 말로 하기';el('voice-start').setAttribute('aria-pressed','false');const text=spoken;spoken='';if(!text)return;const command=classify(text);if(command.kind==='cancel')cancel();else if(command.kind==='confirm'&&pending)execute();else review(text);};
  try{recognition.start()}catch{stop();say('마이크를 시작하지 못했어요. 다시 눌러주세요.')}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden){spoken='';stop();window.speechSynthesis?.cancel()}});
 window.addEventListener('pagehide',stop);
 window.seniorgramVoiceClassify=classify;
};
