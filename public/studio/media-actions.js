/* Local media actions only. A native share resolving is not proof of delivery. */
(()=>{
 let busy=false,saveDialog=null,version=0;
 const types={'image/png':['.png'],'image/jpeg':['.jpg'],'image/webp':['.webp'],'video/mp4':['.mp4'],'video/webm':['.webm']};
 const notice=(node,text)=>{if(node&&node.isConnected!==false)node.textContent=text};
 function media(blob,name){
  const type=blob?.type?.split(';')[0].toLowerCase();
  if(!(blob instanceof Blob)||!blob.size||blob.size>100*1024*1024||!types[type])throw Error('완성된 이미지나 영상을 먼저 열어주세요.');
  const base=String(name||'시니어그램').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'-').replace(/\.[^.]*$/,'').replace(/^\.+/,'').trim().slice(0,70)||'시니어그램';
  return {type,name:base+types[type][0],blob};
 }
 async function share(blob,name,status){
  if(busy){notice(status,'열려 있는 저장·공유창을 먼저 마쳐주세요.');return 'busy'}
  let item;try{item=media(blob,name)}catch(error){notice(status,error.message);return 'invalid'}
  busy=true;
  try{
   const file=new File([item.blob],item.name,{type:item.type});
   if(!navigator.share||!navigator.canShare?.({files:[file]})){notice(status,'이 브라우저는 파일 공유를 지원하지 않아요. 파일로 저장한 뒤 원하는 앱에서 첨부해주세요.');return 'unsupported'}
   notice(status,'공유창에서 보낼 앱과 받을 사람을 직접 선택하세요.');
   await navigator.share({files:[file]});
   notice(status,'공유창에서 선택을 마쳤어요. 실제 전송 결과는 선택한 앱에서 확인해주세요.');return 'selected';
  }catch(error){
   if(error.name==='AbortError'){notice(status,'공유를 취소했어요. 작품은 그대로 남아 있어요.');return 'cancelled'}
   notice(status,error.name==='InvalidStateError'?'다른 공유창이 열려 있어요. 먼저 마친 뒤 다시 눌러주세요.':'공유창을 열지 못했어요. 파일로 저장한 뒤 원하는 앱에서 첨부해주세요.');return 'failed';
  }finally{busy=false}
 }
 function requested(status){const text='브라우저에 파일 저장을 요청했어요. 기기의 다운로드 또는 파일 앱에서 확인해주세요. 사진첩에 자동으로 들어가지 않을 수 있어요.';notice(status,text);return text}
 async function chooseFile(blob,name,status){
  if(busy){notice(status,'열려 있는 저장·공유창을 먼저 마쳐주세요.');return 'busy'}
  let item;try{item=media(blob,name)}catch(error){notice(status,error.message);return 'invalid'}
  if(typeof window.showSaveFilePicker!=='function'||window.isSecureContext===false){notice(status,'이 브라우저에서는 저장 위치를 직접 고를 수 없어요. 파일 다운로드나 공유창을 이용해주세요.');return 'unsupported'}
  busy=true;let writable;const run=version;
  try{
   notice(status,'저장 위치와 파일 이름을 골라주세요.');
   // Must run from the button gesture, before any awaited preparation.
   const handle=await window.showSaveFilePicker({suggestedName:item.name,types:[{description:item.type.startsWith('image/')?'이미지 카드':'영상 카드',accept:{[item.type]:types[item.type]}}]});
   if(run!==version)return 'cancelled';
   writable=await handle.createWritable();
   if(run!==version){await writable.abort();return 'cancelled'}
   notice(status,'파일을 저장하고 있어요. 이 화면을 잠시 열어두세요.');await writable.write(item.blob);
   if(run!==version){await writable.abort();return 'cancelled'}
   await writable.close();writable=null;notice(status,'선택한 위치에 파일을 저장했어요.');return 'saved';
  }catch(error){
   if(writable)try{await writable.abort()}catch{}
   if(error.name==='AbortError'){notice(status,'저장을 취소했어요. 작품은 그대로 남아 있어요.');return 'cancelled'}
   notice(status,'선택한 위치에 저장하지 못했어요. 아래 파일 다운로드나 공유창을 이용해주세요.');return 'failed';
  }finally{busy=false}
 }
 function openSave(blob,name,message){
  let item;try{item=media(blob,name)}catch{return null}
  if(saveDialog)saveDialog.close();
  const dialog=document.createElement('dialog');saveDialog=dialog;dialog.className='sg-member-dialog sg-media-save';dialog.setAttribute('aria-labelledby','sg-media-save-title');
  dialog.innerHTML='<button class="secondary" data-close>저장 안내 닫기</button><h1 id="sg-media-save-title">내 기기에 파일 저장하기</h1><div data-preview></div><p data-guide></p><button class="primary wide" data-pick hidden>저장 위치 골라 저장하기</button><a class="secondary wide" data-download>파일 다운로드</a><button class="secondary wide" data-share>휴대폰 공유창 열기</button><p role="status" aria-live="polite" data-status></p><p class="hint">파일 다운로드는 저장 요청을 보냅니다. 기기에서 파일을 확인해주세요. 공유창 선택만으로 실제 전송이 완료되었다고 판단하지 않습니다.</p>';
  const url=URL.createObjectURL(item.blob),status=dialog.querySelector('[data-status]'),download=dialog.querySelector('[data-download]'),pick=dialog.querySelector('[data-pick]'),shareButton=dialog.querySelector('[data-share]');
  if(message)status.textContent=message;
  download.href=url;download.download=item.name;download.onclick=()=>requested(status);
  if(item.type.startsWith('image/')){const image=document.createElement('img');image.src=url;image.alt='저장할 완성 카드';dialog.querySelector('[data-preview]').append(image)}
  dialog.querySelector('[data-guide]').textContent=item.type.startsWith('image/')?'휴대폰에서는 이미지를 길게 눌러 사진에 저장할 수 있어요. 메뉴가 없으면 파일 다운로드 또는 공유창을 이용하세요.':'영상 파일을 저장한 뒤 원하는 앱에서 첨부하세요. 기기와 앱에 따라 지원하는 영상 형식이 다릅니다.';
  pick.hidden=typeof window.showSaveFilePicker!=='function'||window.isSecureContext===false;
  pick.onclick=async()=>{pick.disabled=true;try{await chooseFile(item.blob,item.name,status)}finally{if(pick.isConnected)pick.disabled=false}};
  shareButton.onclick=async()=>{shareButton.disabled=true;try{await share(item.blob,item.name,status)}finally{if(shareButton.isConnected)shareButton.disabled=false}};
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{version++;URL.revokeObjectURL(url);dialog.remove();if(saveDialog===dialog)saveDialog=null},{once:true});document.body.append(dialog);dialog.showModal();return dialog;
 }
 function cleanup(){version++;if(saveDialog)saveDialog.close()}
 window.seniorgramMedia={share,chooseFile,openSave,requested,cleanup};
})();
