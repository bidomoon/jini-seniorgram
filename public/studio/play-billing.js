// Restore purchases via the platform service. Purchase tokens never enter the DOM,
// URLs, localStorage or browser history. No purchase/charge is initiated here.
(()=>{
 const api=async(path,body)=>{
  const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  let data;try{data=await response.json()}catch{throw Error('구매 확인 서버에 연결하지 못했어요. 다시 구매하지 말고 잠시 후 확인해주세요.')}
  if(!response.ok)throw Error(data.error||'구매 확인을 마치지 못했어요.');return data;
 };
 window.seniorgramPlay={async open(){
  document.querySelector('#sg-play-dialog')?.close();
  const dialog=document.createElement('dialog');dialog.id='sg-play-dialog';dialog.className='sg-member-dialog';dialog.setAttribute('aria-labelledby','sg-play-title');
  dialog.innerHTML='<button class="secondary" data-close>닫기</button><h1 id="sg-play-title">Google Play 구매 복원</h1><div data-body><p role="status">구매 연결 상태를 확인하고 있어요…</p></div>';
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  const box=dialog.querySelector('[data-body]');let working=false;
  try{
   const config=await api('billing/play/config');if(!dialog.isConnected)return;
   if(!config.ready){box.textContent='Google Play 구매 복원 연결을 준비하고 있어요. 현재 구독 결제는 열리지 않았습니다.';return}
   const me=await api('account/me');if(!dialog.isConnected)return;
   if(!me.user){box.innerHTML='<p>구매를 연결할 카카오 계정으로 먼저 로그인해주세요.</p><button class="secondary wide" data-login>로그인 안내 보기</button>';box.querySelector('[data-login]').onclick=()=>{dialog.close();window.seniorgramAccount?.open()};return}
   let service;try{service=await window.getDigitalGoodsService?.('https://play.google.com/billing')}catch{}
   if(!dialog.isConnected)return;
   box.innerHTML='<p>현재 로그인한 카카오 계정의 이용권을 확인합니다. 앱을 다시 설치하거나 기기를 바꿨을 때 기존 구매를 복원할 수 있어요.</p><p class="status">Google Play에서 구독을 해지하거나 환불받았다면 상태 확인으로 반영됩니다. 이 버튼은 새로 결제하지 않아요.</p><label class="check-row"><input type="checkbox" data-consent>현재 카카오 계정에 구매를 연결합니다. 연결 후 다른 시니어그램 계정으로 구매를 이전할 수 없음을 확인했습니다.</label><button class="primary wide" data-restore>이 기기의 Google Play 구매 복원</button><button class="secondary wide" data-sync>이미 연결한 구독 상태 다시 확인</button><p role="status" aria-live="polite" data-status></p>';
   const status=box.querySelector('[data-status]'),restore=box.querySelector('[data-restore]'),sync=box.querySelector('[data-sync]'),consent=box.querySelector('[data-consent]');
   if(!service?.listPurchases){restore.disabled=true;status.textContent='Google Play로 설치한 시니어그램 앱에서 기기의 구매를 복원할 수 있어요. 이 브라우저에서는 이미 연결한 구독 상태만 확인할 수 있어요.'}
   const execute=async(fn)=>{
    if(working)return;if(!consent.checked){status.textContent='구매를 연결할 계정에 대한 안내를 확인해주세요.';consent.focus();return}
    working=true;restore.disabled=sync.disabled=true;status.textContent='구매 내역을 확인하고 있어요. 다시 결제하지 않아도 됩니다.';
    try{await fn();await window.seniorgramAccount?.refresh()}catch(error){if(dialog.isConnected)status.textContent=error.message}finally{working=false;if(dialog.isConnected){restore.disabled=!service?.listPurchases;sync.disabled=false}}
   };
   restore.onclick=()=>execute(async()=>{
    const purchases=await service.listPurchases(),allowed=new Set(config.products.map(p=>p.product));
    if(!Array.isArray(purchases)||purchases.length>20)throw Error('구매 목록을 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
    const own=purchases.filter(p=>allowed.has(p.itemId));if(!own.length){status.textContent='이 Google Play 계정에서 시니어그램 구매를 찾지 못했어요. 구매한 Google 계정인지 확인해주세요.';return}
    let active=0;
    for(const purchase of own){const result=await api('billing/play/verify',{purchaseToken:purchase.purchaseToken,bindConsent:true});if(result.purchase?.active)active++}
    if(dialog.isConnected)status.textContent=active?'구매를 복원했어요. 내 이용권에서 남은 횟수를 확인하세요.':'구매를 확인했어요. 현재 이용 가능한 구독은 없으며 결제는 발생하지 않았어요.';
   });
   sync.onclick=()=>execute(async()=>{const result=await api('billing/play/sync',{});if(dialog.isConnected)status.textContent=result.purchases.some(p=>p.active)?'구독 상태를 확인했어요. 내 이용권에서 남은 횟수를 확인하세요.':'현재 이용 가능한 연결 구독이 없어요. 새로 결제하지 않았다면 구독을 구매한 Google Play 계정을 확인해주세요.'});
  }catch(error){if(dialog.isConnected)box.textContent=error.message}
 }};
})();
