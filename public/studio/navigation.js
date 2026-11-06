// History entries contain screen names only, never a photo, recording or prompt.
window.createSeniorgramNavigation = function ({ render, isBlocked, onBlocked, normalizePage = p => p }) {
  const pages = new Set(['home', 'templates', 'edit', 'result', 'ai-image', 'ai-video', 'gallery', 'feed']);
  const read = state => {
    const entry = state?.seniorgramNavigation;
    return entry && pages.has(entry.page) && Number.isSafeInteger(entry.position) && entry.position >= 0 ? entry : null;
  };
  let current = read(history.state) || { page: 'home', position: 0 };
  let restoring = false;
  function write(entry, replace, url) {
    history[replace ? 'replaceState' : 'pushState']({ ...history.state, seniorgramNavigation: entry }, '', url);
    current = entry;
  }
  function pageURL(page) {
    const url = new URL(location.href);
    if (page !== 'feed') url.searchParams.delete('post');
    return url.pathname + url.search;
  }
  window.addEventListener('popstate', event => {
    const target = read(event.state);
    if (restoring) { restoring = false; return; }
    if (!target) return;
    if (isBlocked()) {
      onBlocked();
      const distance = current.position - target.position;
      if (distance) { restoring = true; history.go(distance); }
      else write(current, true, pageURL(current.page));
      return;
    }
    current = { ...target, page: normalizePage(target.page) };
    write(current, true, pageURL(current.page));
    render(current.page);
  });
  return {
    start(page) {
      current = { page, position: current.position };
      write(current, true, pageURL(page));
      render(page);
    },
    go(page) {
      if (!pages.has(page)) return false;
      if (restoring || isBlocked()) { onBlocked(); return false; }
      page = normalizePage(page);
      const url = pageURL(page);
      const same = page === current.page && url === location.pathname + location.search;
      write({ page, position: current.position + (same ? 0 : 1) }, same, url);
      render(page);
      return true;
    }
  };
};
