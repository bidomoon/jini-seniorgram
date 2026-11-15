// Finished media is stored only after an explicit click, in this browser's IndexedDB.
window.createSeniorgramWorkStore = function ({ indexedDB = window.indexedDB } = {}) {
 const DB = 'seniorgram-local-works', LIMIT = 30, BYTES = 100 * 1024 * 1024, FILE_BYTES = 25 * 1024 * 1024;
 let opening;
 const unavailable = () => Error('이 브라우저에서는 작품을 보관할 수 없어요. 파일 저장을 이용해주세요.');
 function open() {
  if (!indexedDB) return Promise.reject(unavailable());
  if (!opening) opening = new Promise((resolve, reject) => {
   let request;
   try { request = indexedDB.open(DB, 1); } catch { reject(unavailable()); return; }
   request.onupgradeneeded = () => {
    request.result.createObjectStore('works', { keyPath: 'id' });
    request.result.createObjectStore('files', { keyPath: 'id' });
   };
   let blocked = false;
   request.onblocked = () => { blocked = true; reject(Error('다른 시니어그램 창을 닫고 다시 시도해주세요.')); };
   request.onerror = () => reject(unavailable());
   request.onsuccess = () => {
    if (blocked) { request.result.close(); return; }
    const db = request.result;
    db.onversionchange = () => { db.close(); opening = null; };
    db.onclose = () => { opening = null; };
    resolve(db);
   };
  }).catch(error => { opening = null; throw error; });
  return opening;
 }
 async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
   let tx, result, failure;
   try { tx = db.transaction(['works', 'files'], mode); }
   catch { reject(unavailable()); return; }
   tx.oncomplete = () => resolve(result);
   tx.onabort = () => reject(failure || Error(tx.error?.name === 'QuotaExceededError' ? '기기 저장 공간이 부족해요. 파일로 저장한 뒤 필요 없는 보관 작품을 지워주세요.' : '작품 보관에 실패했어요. 파일 저장을 이용해주세요.'));
   tx.onerror = () => {}; // onabort reports failures; success requires the entire transaction to commit.
   try { action(tx, value => { result = value; }, error => { failure = error; tx.abort(); }); }
   catch (error) { failure = error; tx.abort(); }
  });
 }
 function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id); }
 return {
  limits: { count: LIMIT, bytes: BYTES, fileBytes: FILE_BYTES },
  async save({ id, title, kind, blob }) {
   if (!validId(id) || !['image','video'].includes(kind) || !(blob instanceof Blob) || !blob.size || blob.size > FILE_BYTES ||
       !(kind === 'image' ? blob.type === 'image/png' : /^video\/(mp4|webm)(;|$)/.test(blob.type))) throw Error('보관할 파일을 확인해주세요. PNG 카드 또는 25MB 이하 MP4·WebM 영상만 보관할 수 있어요.');
   return run('readwrite', (tx, finish, fail) => {
    const works = tx.objectStore('works'), req = works.getAll();
    req.onsuccess = () => {
     const previous = req.result.find(x => x.id === id);
     if (previous) {
      // An export ID is immutable: repeated taps cannot duplicate or overwrite it.
      finish(previous); return;
     }
     if (req.result.length >= LIMIT || req.result.reduce((sum, x) => sum + x.size, 0) + blob.size > BYTES) {
      fail(Error('보관함이 가득 찼어요. 최대 30개·100MB까지 보관해요. 파일로 저장한 뒤 필요 없는 작품을 지워주세요.')); return;
     }
     const item = { id, title: String(title || '내 작품').slice(0, 80), kind, mime: blob.type, size: blob.size, created: Date.now() };
     works.add(item); tx.objectStore('files').add({ id, blob }); finish(item);
    };
   });
  },
  list() { return run('readonly', (tx, finish) => { const req = tx.objectStore('works').getAll(); req.onsuccess = () => finish(req.result.sort((a,b) => b.created - a.created)); }); },
  async get(id) {
   if (!validId(id)) return null;
   return run('readonly', (tx, finish) => {
    const meta = tx.objectStore('works').get(id), file = tx.objectStore('files').get(id);
    file.onsuccess = () => finish(meta.result && file.result ? { ...meta.result, blob: file.result.blob } : null);
   });
  },
  async remove(id) {
   if (!validId(id)) return;
   return run('readwrite', (tx) => { tx.objectStore('works').delete(id); tx.objectStore('files').delete(id); });
  },
  async close() { if (opening) { const db = await opening; db.close(); opening = null; } }
 };
};

window.initSeniorgramLocalWorks = function ({ toast }) {
 const store = window.createSeniorgramWorkStore();
 const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let viewer = null, deletion = null, loadVersion = 0, selected = null;
 function cleanup() { selected=null; loadVersion++; if (viewer) viewer.close(); if (deletion) deletion.close(); }
 async function view(id, container) {
  const version = ++loadVersion;
  try {
   const item = await store.get(id);
   if (version !== loadVersion || !container.isConnected) return;
   if (!item) { toast('작품을 찾지 못했어요. 다른 창에서 삭제했는지 확인해주세요.'); return; }
   const url = URL.createObjectURL(item.blob), name = '시니어그램-' + item.kind + (item.kind === 'image' ? '.png' : item.mime.startsWith('video/mp4') ? '.mp4' : '.webm');
   const dialog = document.createElement('dialog'); viewer = dialog;
   dialog.className = 'sg-member-dialog sg-local-viewer'; dialog.setAttribute('aria-labelledby', 'local-work-title');
   dialog.innerHTML = `<button class="secondary" data-close>닫기</button><h1 id="local-work-title">${esc(item.title)}</h1>${item.kind === 'image' ? `<img class="saved-image" src="${url}" alt="${esc(item.title)}">` : `<video class="video-player" src="${url}" controls playsinline preload="metadata"></video>`}<a class="primary wide" href="${url}" download="${name}">파일로 저장하기</a><button class="secondary wide" data-share>휴대폰 공유창 열기</button><button class="secondary wide" data-save-help>저장 방법 · 저장 위치 선택</button><button class="secondary wide" data-voice>말로 저장 · 공유 안내</button><p role="status" data-status></p><p class="hint">공유할 앱과 받을 사람을 직접 선택하세요. 이 파일은 자동으로 전송되지 않아요.</p>`;
   selected={...item,name};
   document.body.append(dialog);
   dialog.querySelector('[data-close]').onclick = () => dialog.close();
   const status=dialog.querySelector('[data-status]'),shareButton=dialog.querySelector('[data-share]');
   shareButton.onclick=async()=>{shareButton.disabled=true;try{await window.seniorgramMedia.share(item.blob,name,status)}finally{if(shareButton.isConnected)shareButton.disabled=false}};
   dialog.querySelector('[data-save-help]').onclick=()=>window.seniorgramMedia.openSave(item.blob,name);
   dialog.querySelector('[data-voice]').onclick=()=>window.seniorgramVoice?.open();
   dialog.querySelector('a[download]').onclick=()=>window.seniorgramMedia.requested(status);
   dialog.addEventListener('close', () => { dialog.querySelector('video')?.pause(); URL.revokeObjectURL(url); dialog.remove(); if (viewer === dialog) {viewer = null; selected=null;} if (container.isConnected) container.querySelector(`[data-local-open="${id}"]`)?.focus(); }, { once:true });
   dialog.showModal();
  } catch(error) { toast(error.message); }
 }
 async function render(container) {
  const version = ++loadVersion;
  container.innerHTML = '<p role="status">이 기기에 보관한 작품을 불러오고 있어요…</p>';
  try {
   const items = await store.list();
   if (version !== loadVersion || !container.isConnected) return;
   container.innerHTML = items.length ? `<p>${items.length} / 30개 보관 중 · ${(items.reduce((sum,x)=>sum+x.size,0)/1024/1024).toFixed(1)} / 100MB</p><div class="sg-local-grid">${items.map(item=>`<article class="sg-local-card"><p>${item.kind === 'image' ? '이미지 카드' : '영상 카드'} · ${new Date(item.created).toLocaleDateString('ko-KR')}</p><h3>${esc(item.title)}</h3><button class="primary wide" data-local-open="${item.id}">열기 · 저장 · 공유</button><button class="back" data-local-delete="${item.id}">이 기기에서 삭제</button></article>`).join('')}</div>` : '<p>아직 보관한 작품이 없어요. 카드 완성 화면에서 ‘이 기기 내 작품에 보관’을 눌러주세요.</p>';
   container.querySelectorAll('[data-local-open]').forEach(button=>button.onclick=()=>view(button.dataset.localOpen,container));
   container.querySelectorAll('[data-local-delete]').forEach(button=>button.onclick=()=>{
    const item=items.find(x=>x.id===button.dataset.localDelete);
    const dialog=document.createElement('dialog');deletion=dialog;dialog.className='sg-member-dialog';dialog.setAttribute('aria-labelledby','local-delete-title');
    dialog.innerHTML=`<h1 id="local-delete-title">이 기기에서 작품을 지울까요?</h1><p>${esc(item.title)}</p><p>보관함에서 지우면 되돌릴 수 없어요. 필요한 작품은 먼저 파일로 저장해주세요. 사진첩이나 외부로 보낸 파일은 지워지지 않아요.</p><button class="secondary wide" data-cancel>그대로 두기</button><button class="secondary wide" data-confirm>이 작품 삭제하기</button><p role="status" data-status></p>`;
    document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{dialog.remove();if(deletion===dialog)deletion=null;if(container.isConnected)button.focus()},{once:true});
    dialog.querySelector('[data-confirm]').onclick=async()=>{const confirm=dialog.querySelector('[data-confirm]');confirm.disabled=true;try{await store.remove(item.id);dialog.close();await render(container);toast('이 기기의 보관함에서 삭제했어요.')}catch(error){dialog.querySelector('[data-status]').textContent=error.message;confirm.disabled=false}};
    dialog.showModal();
   });
  } catch(error) { if (version === loadVersion && container.isConnected) container.textContent = error.message; }
 }
 return {
  cleanup, render, current:()=>selected,
  async save(item) {
   const saved = await store.save(item);
   toast('이 기기 내 작품에 보관했어요. 창을 닫아도 다시 열 수 있어요.');
   return saved;
  }
 };
};
