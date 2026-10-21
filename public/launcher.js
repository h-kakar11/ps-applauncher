'use strict';
/* ======================= Launcher: start, resume, close, scan ======================= */

const SOURCE_LABEL = {
  steam: 'Steam', epic: 'Epic Games', gog: 'GOG', ubisoft: 'Ubisoft Connect', ea: 'EA app',
  xbox: 'Xbox', shortcut: 'Shortcuts', folder: 'Games folders', manual: 'Added by hand',
};

/* ----- Launch splash: shown from the press of Play until the game is up ----- */
const launchSplash = { id: null, since: 0, shownRunningAt: 0, poll: null };

function launchSplashActive() { return launchSplash.id !== null; }

function showLaunchSplash(g) {
  const el = $('#launch-splash');
  launchSplash.id = g.id;
  launchSplash.since = Date.now();
  launchSplash.shownRunningAt = 0;
  const art = g.background || g.cover;
  el.style.setProperty('--splash-art', art ? `url("${art}")` : 'none');
  el.innerHTML = `
    <div class="splash-card">
      <div class="splash-cover">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : `<span>${esc(g.name)}</span>`}<i class="splash-ring"></i></div>
      <h2 class="splash-title">${esc(g.name)}</h2>
      <p class="splash-sub" data-splash-sub>Starting…</p>
      <p class="splash-hint"><i class="glyph">${state.settings.confirmButton === 'circle' ? '✕' : '○'}</i>Hide</p>
    </div>`;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('is-visible');
  clearInterval(launchSplash.poll);
  launchSplash.poll = setInterval(refresh, 1000);
}

function hideLaunchSplash() {
  if (!launchSplashActive()) return false;
  const el = $('#launch-splash');
  clearInterval(launchSplash.poll);
  launchSplash.id = null;
  el.classList.remove('is-visible');
  setTimeout(() => { if (!launchSplashActive()) el.hidden = true; }, 400);
  focusView();
  return true;
}

function updateLaunchSplash() {
  if (!launchSplashActive()) return;
  const g = byId(launchSplash.id);
  if (!g) return void hideLaunchSplash();
  const sub = $('[data-splash-sub]');
  if (g.status === 'running') {
    if (!launchSplash.shownRunningAt) {
      launchSplash.shownRunningAt = Date.now();
      if (sub) sub.textContent = 'Now playing';
      $('#launch-splash').classList.add('is-ready');
    } else if (Date.now() - launchSplash.shownRunningAt > 1400) {
      $('#launch-splash').classList.remove('is-ready');
      hideLaunchSplash();
    }
    return;
  }
  const waited = Date.now() - launchSplash.since;
  if (g.status === 'idle' && waited > 4000) return void hideLaunchSplash(); // the server gave up waiting
  if (sub && waited > 12000) sub.textContent = g.launch.type === 'exe' ? 'Still waiting for the game to open…' : 'Waiting for the launcher… this can take a while';
  if (waited > 90000) hideLaunchSplash();
}

/* ----- Start, resume, close ----- */
async function launchGame(id) {
  const g = byId(id);
  if (!g) return;
  if (g.status === 'running') return resumeGame(id);
  if (g.status === 'starting') return showLaunchSplash(g);
  if (!g.exeExists) return toast(g.launch.type === 'exe' ? 'Executable not found. Edit the game to fix its path.' : 'The game’s folder is missing. It may have been uninstalled.', 5000);
  try {
    sfx.launch();
    rumble(0.35, 0.6, 180);
    await api(`/api/games/${id}/launch`, { method: 'POST' });
    g.status = 'starting';
    renderStage();
    showLaunchSplash(g);
    setTimeout(refresh, 1200);
  } catch (e) {
    toast(e.message, 5000);
  }
}

async function resumeGame(id) {
  const g = byId(id);
  if (!g) return;
  try {
    const r = await api(`/api/games/${id}/launch`, { method: 'POST' });
    sfx.select();
    toast(r.focused ? `Switched to ${g.name}` : `${g.name} is running. Switch to it with Alt+Tab.`, 3500);
  } catch (e) {
    toast(e.message, 5000);
  }
}

async function closeGame(id) {
  const g = byId(id);
  if (!g) return;
  if (state.settings.confirmClose && !(await confirmDialog(`Close ${g.name}?`, 'The game will be shut down right away. Anything you haven’t saved will be lost.', 'Close game'))) return;
  try {
    await api(`/api/games/${id}/close`, { method: 'POST' });
    toast(`Closing ${g.name}…`);
    setTimeout(refresh, 2500);
  } catch (e) {
    toast(e.message, 5000);
  }
}

/* ----- Now playing chip in the top bar ----- */
function renderNowPlaying() {
  const el = $('#now-playing');
  const live = state.games.filter((g) => g.status === 'running').sort((a, b) => b.runningSince - a.runningSince);
  el.hidden = !live.length;
  if (!live.length) { el.dataset.id = ''; delete el.dataset.sig; return; }
  const g = live[0];
  const sig = `${g.id}|${live.length}`;
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    el.dataset.id = g.id;
    el.innerHTML = `<i class="live-dot"></i><span class="np-name">${esc(g.name)}${live.length > 1 ? ` +${live.length - 1}` : ''}</span><span class="np-time" data-elapsed-since="${g.runningSince}"></span>`;
    updateElapsed();
  }
}

/* ----- Scanning ----- */
async function scanFolder() {
  try {
    toast('Looking for games…', 8000);
    const r = await api('/api/scan', { method: 'POST' });
    await refresh();
    if (r.added.length) {
      if (state.settings.autoArtwork) watchArtwork();
      toast(`${r.added.length} new ${r.added.length === 1 ? 'game' : 'games'} added`);
      return openScanResults(r);
    }
    const checked = Object.keys(r.sources).map((k) => SOURCE_LABEL[k] || k);
    const hasFolders = state.settings.gameFolders.length > 0;
    toast(hasFolders || checked.length
      ? `No new games found${checked.length ? ` (checked ${checked.join(', ')})` : ''}`
      : 'No games folder or game launcher found. Add a games folder in Settings.', 5500);
  } catch (e) {
    toast(e.message, 5000);
  }
}

function openScanResults(r) {
  const groups = {};
  for (const d of r.details) (groups[d.source] ||= []).push(d);
  const layer = openLayer(`
    <div class="modal menu scan-results" role="dialog" aria-label="New games">
      <h2>${r.added.length} new ${r.added.length === 1 ? 'game' : 'games'}</h2>
      <div class="menu-list">
        ${Object.entries(groups).map(([src, list]) => `
          <h3 class="list-heading">${esc(SOURCE_LABEL[src] || src)}</h3>
          ${list.map((d) => `<button class="menu-item" data-nav data-go-game="${d.id}">${ICON.gamepad}${esc(d.name)}</button>`).join('')}`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-done autofocus>Done</button></div>
    </div>`);
  layer.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go-game]');
    if (go) { closeLayer(layer); return goToGame(go.dataset.goGame); }
    if (e.target.closest('[data-done]')) closeLayer(layer);
  });
}

function pickRandomGame() {
  const pool = [];
  for (const g of state.games) {
    if (!g.exeExists || g.status === 'running') continue;
    const weight = (g.playMs < 60000 ? 3 : 1) + (g.progress === 'backlog' ? 3 : 0) + (g.progress === 'playing' ? 2 : 0) + (g.favorite ? 2 : 0) - (g.progress === 'dropped' || g.progress === 'completed' ? 1 : 0);
    for (let i = 0; i < Math.max(1, weight); i++) pool.push(g);
  }
  if (!pool.length) return toast('Add a game first');
  const g = pool[Math.floor(Math.random() * pool.length)];
  sfx.select();
  toast(`How about ${g.name}?`, 3500);
  goToGame(g.id);
}

/* ----- Background events from the service ----- */
function handleEvents(list) {
  for (const e of list) {
    if (e.type === 'scan' && e.auto) {
      const names = e.added.slice(0, 3).join(', ');
      toast(`${e.added.length} new ${e.added.length === 1 ? 'game' : 'games'} found: ${names}${e.added.length > 3 ? '…' : ''}`, 6000);
      if (state.settings.autoArtwork) watchArtwork();
    } else if (e.type === 'game-ended') {
      toast(`You played ${e.name} for ${fmtHM(e.ms)}`, 5500);
    } else if (e.type === 'launch-failed') {
      hideLaunchSplash();
      sfx.alert();
      toast(e.message, 9000);
    }
  }
}

refreshHooks.push(renderNowPlaying, updateLaunchSplash);
$('#now-playing').addEventListener('click', () => { const id = $('#now-playing').dataset.id; if (id) goToGame(id); });
