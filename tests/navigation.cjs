const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const location = new URL('https://jini-seniorgram.netlify.app/?source=android&post=example');
const entries = [{ state: null, url: location.href }];
let index = 0, blocked = false, warnings = 0, screen;
const history = {
  get state() { return entries[index].state; },
  replaceState(state, _, url) { entries[index] = { state, url }; location.href = new URL(url, location).href; },
  pushState(state, _, url) { entries.splice(++index); entries.push({ state, url }); location.href = new URL(url, location).href; },
  go(distance) {
    index += distance; assert(index >= 0 && index < entries.length);
    location.href = new URL(entries[index].url, location).href;
    listeners.popstate({ state: entries[index].state });
  }
};
const window = { addEventListener(type, fn) { listeners[type] = fn; } };
vm.runInNewContext(fs.readFileSync('public/studio/navigation.js', 'utf8'), { window, history, location, URL, Set, Number });
const navigation = window.createSeniorgramNavigation({ render: page => { screen = page; }, isBlocked: () => blocked, onBlocked: () => warnings++ });
navigation.start('feed');
assert.equal(location.searchParams.get('post'), 'example', 'shared feed URL survives startup');
navigation.go('templates'); navigation.go('edit'); navigation.go('result');
assert.equal(location.searchParams.get('source'), 'android', 'app entry source survives navigation');
assert.equal(location.searchParams.has('post'), false, 'leaving feed clears its post filter');
history.go(-1); assert.equal(screen, 'edit', 'phone back returns from result to editor');
history.go(-1); assert.equal(screen, 'templates');
history.go(1); assert.equal(screen, 'edit', 'forward restores editor');
blocked = true;
history.go(-1); assert.equal(screen, 'edit', 'recording/export keeps the current screen');
assert.equal(history.state.seniorgramNavigation.page, 'edit', 'blocked back restores the current entry');
assert.equal(warnings, 1);
assert.equal(navigation.go('home'), false, 'buttons cannot interrupt active work');
blocked = false; history.go(-1); assert.equal(screen, 'templates');
const length = entries.length; navigation.go('templates'); assert.equal(entries.length, length, 'same-screen button does not trap back');
navigation.go('gallery'); assert.equal(screen, 'gallery'); assert.equal(entries.at(-1).state.seniorgramNavigation.page, 'gallery');
history.go(-1); history.go(-1); assert.equal(screen, 'feed');
assert.equal(location.searchParams.get('post'), 'example', 'back restores the shared post URL');
for (const entry of entries) assert.deepEqual(Object.keys(entry.state.seniorgramNavigation).sort(), ['page', 'position'], 'history stores no private media or form data');
console.log('PASS navigation: phone back/forward, shared links, app source, active-work protection, duplicate entries, private data exclusion.');
