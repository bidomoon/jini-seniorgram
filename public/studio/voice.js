/* Voice input always passes through a visible review before acting. */
window.initSeniorgramVoice=function(ctx){
 const panel=document.createElement('section');panel.className='sg-voice-panel';panel.setAttribute('aria-label','말로 만들기');
 panel.innerHTML='<div class="sg-voice-heading"><h2 id="voice-panel-title">말로 하기</h2><button type="button" class="primary" id="voice-start" aria-pressed="false">🎤 말로 하기</button></div><p class="sg-voice-steps">1. 마이크 누르기 → 2. 천천히 말하기 → 3. 내용 확인하기</p><p>“아침 인사 만들어줘”, “손녀 생일 카드 만들어줘”라고 말해보세요.</p><button type="button" class="secondary" id="voice-type">글로 요청하기</button><p id="command-voice-status" role="status" aria-live="polite">말하기가 어려우면 글로 요청하기를 눌러주세요.</p><p id="voice-transcript" aria-live="off" hidden></p><div id="voice-review" hidden><label for="voice-text">요청 내용을 확인하고 고쳐주세요</label><textarea id="voice-text" maxlength="800"></textarea><p id="voice-action"></p><div class="choices"><button class="primary" id="voice-confirm">이 내용으로 계속</button><button class="secondary" id="voice-retry">다시 말하기</button><button class="secondary" id="voice-cancel">취소</button></div></div><div id="voice-next" hidden><button class="secondary wide" id="voice-card-fallback">무료 인사 카드로 만들기</button></div><details><summary>음성 사용 안내</summary><p>마이크를 누를 때만 듣습니다. 첫 사용 시 브라우저에서 마이크 사용을 허용해주세요. 듣기 멈추기를 누르면 멈춰요. 목소리는 브라우저의 음성 인식 서비스로 전송될 수 있습니다. 인식한 내용을 확인한 뒤에만 진행합니다. AI 그림·영상 생성은 이용 횟수가 차감될 수 있습니다.</p><p>“받는 이름을 서준으로 바꿔줘”, “이대로 카드 완성해줘”, “내 작품에 보관해줘”도 사용할 수 있어요. 마이크가 안 되면 글로 요청하기나 휴대폰 키보드의 마이크를 이용하세요.</p><label class="check-row"><input type="checkbox" id="voice-speak"> 안내를 소리로도 듣기</label><p>카카오톡·SNS에 자동 전송하지 않습니다. 공유창에서 앱과 받을 사람을 직접 선택하고 전송 결과를 확인해주세요.</p></details>';
 const dock=document.createElement('div');dock.className='sg-voice-dock';dock.hidden=true;dock.append(panel);document.body.append(dock);
 const shortcut=document.createElement('button');shortcut.type='button';shortcut.id='voice-shortcut';shortcut.className='primary sg-voice-shortcut';shortcut.textContent='마이크 · 말로 요청';shortcut.setAttribute('aria-pressed','false');document.body.append(shortcut);
 const home=document.createElement('span');home.hidden=true;panel.before(home);let voiceDialog=null;
 const el=id=>document.getElementById(id),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let recognition=null,listening=false,pending=null,executing=false,spoken='',timer,epoch=0;
 const occasions=[[/졸업|입학/,'school'],[/결혼기념/,'anniversary'],[/(손주|손자|손녀).*생일|생일.*(손주|손자|손녀)/,'grandchild'],[/생일|생신/,'birthday'],[/감사|고마|고맙/,'thanks'],[/아침/,'morning'],[/주말/,'weekend'],[/새해|설날/,'newyear'],[/추석|한가위/,'chuseok'],[/응원/,'support'],[/축하/,'congrats']];
 function say(text){
  el('command-voice-status').textContent=text;
  if(!voiceDialog?.open)ctx.toast?.(text);
  if(el('voice-speak').checked&&window.speechSynthesis&&!listening){try{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ko-KR';window.speechSynthesis.speak(utterance)}catch{}}
 }
 function classify(text){
  const t=text.trim(),compact=t.replace(/\s/g,'').replace(/[.!?。]+$/,'');
  if(/^(취소|그만|멈춰|멈춰줘|그만해|그만해줘)$/.test(compact)||/하지\s*마|말아|취소해/.test(t))return {kind:'cancel'};
  if(/^(네|예|응|좋아|확인|진행해|만들어줘|실행해)$/.test(compact))return {kind:'confirm'};
  if(/모르겠|도와|사용법|안돼|안되|어려워/.test(compact))return {kind:'help'};
  if(/^(처음으로|처음화면|홈으로)(가줘|돌아가줘)?$/.test(compact))return {kind:'home'};
  if(/^(내작품|보관함)(보여줘|열어줘|보기)?$/.test(compact))return {kind:'gallery'};
  if(/^(이대로|그대로|지금)?(카드)?(를|를좀)?완성(해줘|해주세요|하기)?$/.test(compact)||/^(이대로|그대로)카드만들어줘$/.test(compact))return {kind:'finish'};
  if(/^(사진첩|사진앱)(에)?(저장|넣어)(해줘|해주세요|줘)?$/.test(compact))return {kind:'save-help'};
  if(/^(이거|카드|작품|영상|이미지|완성한카드)?(을|를)?(내작품에|보관함에|이기기에)?(저장|보관)(해줘|해주세요|하기|해줄래)?$/.test(compact))return {kind:'save'};
  const field=t.match(/^(받는\s*이름|받는\s*분(?:의\s*이름)?|받는\s*사람(?:의\s*이름)?|이름|보내는\s*분|보내는\s*사람|제목|문구)(?:을|를|은|는)?\s*(.+?)\s*(?:바꿔\s*줘|해\s*줘|써\s*줘|넣어\s*줘)[.!?。]*$/);
  if(field){const value=field[2].trim().replace(/(?:으로|로)$/,'').trim();return {kind:'field',field:/^보내는/.test(field[1])?'sender':field[1]==='제목'?'title':field[1]==='문구'?'message':'recipient',value};}
  const channels=[['instagram',/인스타|instagram/i],['tiktok',/틱톡|tiktok/i],['kakao',/카카오|카톡/],['facebook',/페이스북|페북/],['sms',/문자/]],channel=channels.find(([,pattern])=>pattern.test(t));
  if(channel&&/올려|게시|보내|공유|업로드/.test(t)&&!/그려|만들|생성/.test(t))return {kind:'share',channel:channel[0]};
  const occasion=occasions.find(([pattern])=>pattern.test(compact))?.[1];
  const videoCard=/영상카드|움직이는카드|사진으로영상|사진영상/.test(compact)&&!/AI|인공지능/i.test(t);
  if(videoCard||(!/영상|동영상|비디오|그려|그림|인공지능|AI/i.test(t)&&(/카드/.test(t)||(occasion&&/인사|축하|감사|고마운마음/.test(compact)))))return {kind:'card',occasion,video:videoCard};
  if(/수정|바꿔|더\s*(넣|많)|추가|빼줘|지워|변경/.test(t)&&!/새로운|새\s*그림/.test(t))return {kind:'edit',prompt:t};
  return {kind:/영상|동영상|비디오/.test(t)?'video':'image',prompt:t};
 }
 function describe(){
  const value=el('voice-text').value.trim(),command=classify(value),labels={home:'처음 화면으로 가기',card:command.video?'내 사진으로 꾸미는 영상 카드 편집하기':'무료 인사 카드 편집하기',gallery:'내 작품 보관함 열기',share:'공유 준비 · 받을 사람은 공유창에서 직접 선택해요.',field:'현재 카드의 이름·문구 바꾸기',finish:'현재 편집 중인 카드 완성하기',save:'완성 파일을 이 브라우저의 내 작품에 보관하기','save-help':'사진첩에 저장하는 방법 보기',help:'처음 배우기 안내 열기',edit:'현재 선택한 AI 그림 수정',video:'AI 영상 만들기 · 서버 연결 필요',image:'AI 그림 만들기 · 서버 연결 필요',confirm:'먼저 원하는 내용을 말하거나 적어주세요.',cancel:'요청 취소'};
  el('voice-action').textContent=value?(labels[command.kind]||'내용 확인하기'):'만들고 싶은 내용을 적어주세요.';
  el('voice-confirm').disabled=!value||listening||executing||command.kind==='confirm';
 }
 function clearReview(){pending=null;el('voice-review').hidden=true;el('voice-next').hidden=true;if(voiceDialog?.open)voiceDialog.close();}
 function stop(){
  epoch++;clearTimeout(timer);spoken='';
  if(recognition){recognition.onend=recognition.onresult=recognition.onstart=recognition.onerror=null;try{recognition.abort()}catch{}recognition=null}
  listening=false;shortcut.textContent='마이크 · 말로 요청';shortcut.setAttribute('aria-pressed','false');el('voice-start').textContent='🎤 말로 하기';el('voice-start').setAttribute('aria-pressed','false');el('voice-transcript').hidden=true;describe();
 }
 function cancel(){stop();clearReview();say('요청을 취소했어요. 원하면 다시 말로 하기를 눌러주세요. 이미 접수된 AI 작업은 취소되지 않습니다.');}
 function review(text){
  const command=classify(text);
  if(command.kind==='cancel'){cancel();return}
  if(command.kind==='confirm'){say('먼저 만들고 싶은 내용을 말씀해주세요.');return}
  pending=command;el('voice-text').value=text;el('voice-review').hidden=false;el('voice-next').hidden=true;describe();
  say('이렇게 들었어요. 내용이 맞으면 이 내용으로 계속을 누르세요. 다르면 다시 말하기를 누르세요.');
  el('voice-review').scrollIntoView?.({block:'nearest'});
 }
 async function execute(){
  if(executing||listening||!pending)return;
  const value=el('voice-text').value.trim();if(!value){say('먼저 만들고 싶은 내용을 적어주세요.');el('voice-text').focus();return}
  const command=classify(value);if(command.kind==='cancel'){cancel();return}if(command.kind==='confirm'){say('먼저 원하는 내용을 말하거나 적어주세요.');return}
  executing=true;stop();el('voice-confirm').disabled=true;
  try{
   if(ctx.busy||ctx.recording){say('지금 녹음이나 작품 만들기를 마친 뒤 다시 말씀해주세요.');return}
   if(command.kind==='card'){
    if(command.occasion||command.video)ctx.openOccasion(command.occasion||'morning');else ctx.setPage('templates');
    clearReview();document.querySelector(command.occasion||command.video?'#recipient':'[data-template]')?.focus();
    say(command.video?'영상 카드를 꾸미는 화면을 열었어요. 카드를 완성한 뒤 움직이는 카드를 선택해주세요.':command.occasion?'인사 카드를 열었어요. 이름을 넣거나 “이대로 카드 완성해줘”라고 말씀하세요.':'원하는 카드 디자인을 골라주세요.');return;
   }
   if(command.kind==='field'){say(ctx.updateCard?.(command.field,command.value)||'카드를 먼저 열고 이름이나 문구를 바꿔주세요.');clearReview();return}
   if(command.kind==='finish'){const done=await ctx.finishCard?.();say(done?'카드가 완성됐어요. 이름과 문구를 확인하고 “내 작품에 보관해줘”라고 말씀하세요.':'먼저 편집할 카드를 열어주세요. 준비된 카드 디자인을 골라도 좋아요.');clearReview();return}
   if(command.kind==='save'&&ctx.localMedia?.()){const item=ctx.localMedia();window.seniorgramMedia.openSave(item.blob,item.name);clearReview();say('이 작품은 보관함에 있어요. 파일을 따로 저장하려면 열린 안내의 저장 버튼을 눌러주세요.');return}
   if(command.kind==='save'){const done=await ctx.keepCurrent?.();say(done?'이 브라우저의 내 작품에 보관했어요. 다른 기기와 자동으로 옮겨지지는 않아요.':'완성한 카드를 먼저 열어주세요. 보관이 안 되면 파일 저장 버튼을 이용하세요.');clearReview();return}
   if(command.kind==='save-help'&&ctx.localMedia?.()){const item=ctx.localMedia();window.seniorgramMedia.openSave(item.blob,item.name);clearReview();say('이 작품의 파일 저장 안내를 열었어요. 저장 버튼을 직접 눌러주세요.');return}
   if(command.kind==='save-help'){if(ctx.saveHelp?.()){say('사진첩 저장 방법을 열었어요. 안내에 따라 직접 저장해주세요.')}else say('카드를 먼저 완성해주세요.');clearReview();return}
   if(command.kind==='help'){document.querySelector('#sg-learn-open')?.click();clearReview();say('처음 배우기 안내를 열었어요. 카드 만들기부터 따라 해보세요.');return}
   if(command.kind==='home'){ctx.setPage('home');clearReview();say('처음 화면을 열었어요. 인사 카드나 내 작품을 골라주세요.');return}
   if(command.kind==='gallery'){ctx.setPage('gallery');clearReview();say('내 작품을 열었어요. 원하는 작품의 열기 · 저장 · 공유를 눌러주세요.');return}
   if(command.kind==='share'){
    const aiMedia=document.querySelector('#ai-result video,#ai-result img'),local=ctx.localMedia?.();let blob=null,name='시니어그램.png';
    if(local){blob=local.blob;name=local.name}
    else if(aiMedia){const response=await fetch(aiMedia.src);if(!response.ok)throw Error('완성 파일을 불러오지 못했어요.');blob=await response.blob();if(aiMedia.tagName==='VIDEO')name='시니어그램.mp4'}
    else if(ctx.page==='result'){const video=document.querySelector('#video-actions')&&!document.querySelector('#video-actions').hidden;blob=video?ctx.videoBlob:ctx.pngBlob;if(video)name='시니어그램.'+ctx.videoExt}
    if(!blob){say('보낼 작품을 먼저 완성하고 열어주세요. 보관함 작품은 열린 창의 휴대폰 공유창 열기를 누르세요.');return}
    ctx.sharingDialog(command.channel,blob,name,ctx.currentPostId);clearReview();say(ctx.shareChannels[command.channel].name+' 공유를 준비했어요. 공유창 열기를 누르고 받을 사람을 직접 골라주세요. 아직 전송되지 않았어요.');return;
   }
   if(command.kind==='edit'){
    const edit=document.querySelector('#ai-edit');if(edit)edit.click();else if(!document.querySelector('#ai-unlink')){say('수정할 AI 그림을 먼저 열어주세요. 카드의 글자는 “제목을 생일 축하로 바꿔줘”처럼 말씀하세요.');return}
   }else{
    const target=command.kind==='video'?'ai-video':'ai-image',saved=ctx.readCardLocal(ctx.jobDraftKey(command.kind==='video'?'video':'image'),{});
    if(saved?.requestId||saved?.parentId){ctx.setPage(target);say('이전에 접수하거나 수정하던 작품을 먼저 확인해주세요. 새 요청은 만들기 화면에서 준비할 수 있어요.');return}
    if(ctx.page!==target)ctx.setPage(target);
   }
   const input=document.querySelector('#ai-prompt');if(!input||input.disabled){say('접수된 작업을 확인하고 있어요. 내 작품에서 결과를 확인해주세요.');return}
   input.value=command.prompt;input.dispatchEvent(new Event('input',{bubbles:true}));
   const button=document.querySelector('#ai-generate');
   if(button&&!button.disabled){button.click();clearReview();say('만들기 요청을 보냈어요. 접수 여부와 진행 상황은 아래 만들기 화면에서 확인해주세요.')}
   else{el('voice-next').hidden=false;say('요청 내용은 적어두었어요. 현재 AI 만들기는 연결 준비 중이거나 이용할 수 없는 상태예요. 아래 무료 인사 카드로 만들기를 눌러 먼저 체험하세요.');}
  }catch(error){say(error.message||'처리하지 못했어요. 다시 시도해주세요.')}finally{executing=false;describe()}
 }
 function typeRequest(){stop();if(!pending)el('voice-text').value='';pending={kind:'input'};el('voice-review').hidden=false;el('voice-next').hidden=true;describe();say('원하는 내용을 직접 적거나 휴대폰 키보드의 마이크로 입력해주세요.');el('voice-text').focus()}
 function start(){
  if(listening){const text=spoken;stop();if(text)review(text);else say('듣기를 멈췄어요. 다시 말하거나 글로 요청하기를 누르세요.');return}
  if(!Recognition){typeRequest();say('이 브라우저는 말소리 인식을 지원하지 않아요. 아래에 적거나 휴대폰 키보드의 마이크를 사용해주세요.');return}
  if(ctx.recording||ctx.busy||executing){say('지금 녹음이나 작품 만들기를 마친 뒤 다시 말씀해주세요.');return}
  window.speechSynthesis?.cancel();spoken='';listening=true;const run=++epoch;
  shortcut.textContent='듣기 멈추기';shortcut.setAttribute('aria-pressed','true');el('voice-start').textContent='■ 듣기 취소';el('voice-start').setAttribute('aria-pressed','true');describe();say('마이크를 연결하고 있어요. 권한 안내가 나오면 허용해주세요.');
  timer=setTimeout(()=>{if(run===epoch){stop();say('마이크 응답을 기다리다 멈췄어요. 권한을 확인하거나 글로 요청하기를 이용하세요.')}},20000);
  try{
   recognition=new Recognition();recognition.lang='ko-KR';recognition.interimResults=true;recognition.continuous=false;
   recognition.onstart=()=>{if(run!==epoch)return;clearTimeout(timer);el('voice-start').textContent='■ 듣기 멈추기';say('듣고 있어요. 천천히 말씀한 뒤 잠시 기다리세요.');timer=setTimeout(()=>{if(run===epoch){const text=spoken;stop();if(text)review(text);else say('말소리를 듣지 못했어요. 다시 말하거나 글로 요청해주세요.')}},45000)};
   recognition.onresult=event=>{if(run!==epoch)return;let final='',partial='';for(let i=0;i<event.results.length;i++){partial+=event.results[i][0].transcript;if(event.results[i].isFinal)final+=event.results[i][0].transcript}spoken=(final||partial).trim().slice(0,800);el('voice-transcript').textContent='듣는 중: '+spoken;el('voice-transcript').hidden=!spoken};
   recognition.onerror=event=>{if(run!==epoch)return;stop();say(({'not-allowed':'마이크 사용이 허용되지 않았어요. 브라우저 주소 옆의 사이트 설정에서 마이크를 허용하거나 글로 요청하기를 누르세요.','service-not-allowed':'이 브라우저에서 음성 인식을 허용하지 않아요. 글로 요청하기를 이용해주세요.','no-speech':'말소리를 듣지 못했어요. 마이크를 다시 누르고 천천히 말씀하세요.',network:'음성 인식 연결이 끊겼어요. 인터넷을 확인하거나 글로 요청해주세요.','audio-capture':'마이크를 찾지 못했어요. 마이크 연결을 확인하거나 글로 요청해주세요.',aborted:'듣기를 멈췄어요. 다시 말하거나 글로 요청해주세요.'})[event.error]||'말소리를 알아듣지 못했어요. 다시 말하거나 글로 요청해주세요.')};
   recognition.onend=()=>{if(run!==epoch)return;const text=spoken;stop();if(!text){say('말소리를 듣지 못했어요. 마이크를 다시 누르거나 글로 요청하기를 이용하세요.');return}const command=classify(text);if(command.kind==='cancel')cancel();else if(command.kind==='confirm'&&pending)execute();else review(text)};
   recognition.start();
  }catch{stop();say('마이크를 시작하지 못했어요. 다시 누르거나 글로 요청하기를 이용하세요.')}
 }
 shortcut.onclick=()=>{openVoiceDialog();start()};
 el('voice-text').oninput=()=>{pending={kind:'input'};el('voice-next').hidden=true;describe()};el('voice-confirm').onclick=execute;el('voice-cancel').onclick=cancel;el('voice-type').onclick=typeRequest;el('voice-start').onclick=start;el('voice-retry').onclick=start;
 el('voice-card-fallback').onclick=()=>{stop();clearReview();ctx.setPage('templates');say('무료 카드 디자인을 골라주세요. AI 생성과 로그인 없이 만들 수 있어요.')};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){const wasListening=listening;stop();window.speechSynthesis?.cancel();if(wasListening)say('화면을 벗어나 듣기를 멈췄어요. 다시 마이크를 누르면 들을 수 있어요.')}});
 window.addEventListener('pagehide',stop);
 window.addEventListener('sg-page-changed',()=>{if(!executing){stop();clearReview()}});
 function openVoiceDialog(){
  if(voiceDialog?.open)return;
  stop();clearReview();const dialog=document.createElement('dialog');voiceDialog=dialog;dialog.className='sg-member-dialog sg-voice-dialog';dialog.setAttribute('aria-labelledby','voice-panel-title');
  const close=document.createElement('button');close.className='secondary';close.textContent='음성 창 닫기';close.onclick=()=>dialog.close();dialog.append(close,panel);
  dialog.addEventListener('close',()=>{stop();pending=null;el('voice-review').hidden=true;el('voice-next').hidden=true;if(home.parentNode)home.parentNode.insertBefore(panel,home.nextSibling);dialog.remove();if(voiceDialog===dialog)voiceDialog=null},{once:true});
  document.body.append(dialog);dialog.showModal();say(ctx.localMedia?.()?'열린 작품을 말로 저장하거나 공유할 수 있어요. 마이크 또는 글로 요청하기를 눌러주세요.':'마이크를 누르고 “아침 인사 만들어줘”라고 말씀해보세요. 글로 요청하기를 눌러 적어도 괜찮아요.');
 }
 window.seniorgramVoice={open:openVoiceDialog,close:()=>voiceDialog?.close(),stop};
 window.seniorgramVoiceClassify=classify;
};
