// Local learning progress contains lesson IDs only, never photos, voice or account data.
(()=>{
 const key='seniorgram-lessons-v1';
 const lessons=[
  {id:'card',title:'인사 카드 만들기',steps:['안내를 닫고 ‘예시 골라 만들기’를 누르세요.','마음에 드는 디자인을 고르고 받는 분과 내 이름을 넣으세요.','문구를 확인하고 완성 버튼을 눌러보세요.'],note:'준비된 디자인으로 연습할 때는 카카오 로그인이나 유료 AI가 필요하지 않아요.'},
  {id:'voice',title:'말로 입력하기',steps:['만들기 화면의 ‘말로 하기’ 버튼을 찾으세요.','마이크 사용을 허용하고 원하는 내용을 천천히 말하세요.','화면에 적힌 내용을 읽고, 잘못 적힌 글자는 직접 고치세요.'],note:'음성 인식을 지원하지 않는 기기에서는 글로 입력하세요. 공공장소에서는 개인정보를 말하지 마세요.'},
  {id:'share',title:'저장하고 카카오톡으로 보내기',steps:['완성 화면에서 ‘이미지 파일 저장’을 누르세요.','‘카톡 · SNS로 이미지 공유’를 누르고 카카오톡을 고르세요.','보낼 상대와 이미지를 확인한 뒤 직접 전송하세요.'],note:'공유창에 카카오톡이 없으면 저장한 이미지를 카카오톡 대화방의 + → 사진 또는 파일에서 첨부하세요. 자동으로 발송되지 않아요.'}
 ];
 let done=[];try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))done=lessons.filter(l=>saved.includes(l.id)).map(l=>l.id)}catch{}
 let current=0,dialog;
 function save(){try{localStorage.setItem(key,JSON.stringify(done))}catch{}}
 function render(){const lesson=lessons[current];dialog.innerHTML=`<button class="secondary" id="sg-learn-close">안내 닫기</button><h1 id="sg-learn-title">처음 배우는 시니어그램</h1><p class="hint">이 기기에서 연습 완료 ${done.length} / ${lessons.length} · 직접 연습한 뒤 완료를 눌러주세요.</p><div class="sg-lesson-tabs" role="group" aria-label="배울 내용">${lessons.map((l,i)=>`<button class="chip" data-lesson="${i}" aria-pressed="${i===current}">${i+1}. ${l.title}${done.includes(l.id)?' · 완료':''}</button>`).join('')}</div><h2>${lesson.title}</h2><ol class="sg-welcome-steps">${lesson.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p class="status">${lesson.note}</p><div class="sg-lesson-actions"><button class="primary" id="sg-learn-practice">안내 닫고 연습하기</button><button class="secondary" id="sg-learn-done">${done.includes(lesson.id)?'완료 취소':'연습했어요 · 완료'}</button></div><p class="hint">진도만 이 브라우저에 저장돼요. 다른 기기와 동기화되지 않으며, 브라우저 데이터를 지우면 초기화돼요.</p>`;
 dialog.querySelector('#sg-learn-close').onclick=close;
 dialog.querySelector('#sg-learn-practice').onclick=close;
 dialog.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{current=Number(b.dataset.lesson);render();dialog.querySelector(`[data-lesson="${current}"]`).focus()});
 dialog.querySelector('#sg-learn-done').onclick=()=>{done=done.includes(lesson.id)?done.filter(id=>id!==lesson.id):[...done,lesson.id];save();render();dialog.querySelector('#sg-learn-done').focus()};
 }
 function close(){dialog.close()}
 document.querySelector('#sg-learn-open').onclick=()=>{
  if(dialog?.open)return;
  dialog=document.createElement('dialog');dialog.className='sg-member-dialog';dialog.setAttribute('aria-labelledby','sg-learn-title');
  dialog.addEventListener('close',()=>{dialog.remove();document.querySelector('#sg-learn-open').focus()},{once:true});
  render();document.body.append(dialog);dialog.showModal();
 };
})();
