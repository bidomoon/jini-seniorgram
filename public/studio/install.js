if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', async () => {
    let updating = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
    try {
      const registration = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      function offerUpdate() {
        if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('#sg-app-update')) return;
        const notice = document.createElement('aside');
        notice.id = 'sg-app-update'; notice.className = 'sg-learning-bar'; notice.setAttribute('role', 'status');
        notice.innerHTML = '<div><b>새 버전이 준비됐어요.</b><span>만든 카드와 목소리 파일을 먼저 저장해주세요.</span></div><button class="secondary" type="button">저장했어요 · 업데이트</button>';
        notice.querySelector('button').onclick = () => {
          if (!window.dispatchEvent(new Event('sg-update-request', { cancelable: true }))) return;
          if (!registration.waiting) { notice.remove(); return; }
          updating = true;
          registration.waiting.postMessage({ type: 'SG_ACTIVATE_UPDATE' });
        };
        document.querySelector('header').after(notice);
      }
      offerUpdate();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
    } catch { /* Card editing remains available when registration is unsupported. */ }
  });
}
