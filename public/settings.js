'use strict';
/* ======================= Settings (full-screen, console style) ======================= */

const CATEGORIES = [
  ['profile', 'Profile', ICON.star],
  ['library', 'Games & Library', ICON.library],
  ['launcher', 'Launcher', ICON.play],
  ['appearance', 'Appearance & Sounds', ICON.wallpaper],
  ['controller', 'Controller', ICON.gamepad],
  ['playtime', 'Playtime & Trophies', ICON.stats],
  ['discord', 'Discord', ICON.discord],
  ['data', 'Data & Backup', ICON.storage],
  ['about', 'About & Controls', ICON.file],
];

const settingsUi = { cat: 'profile', startup: null, enums: {} };

const AVATAR_COLORS = [['blue', 'PlayStation blue'], ['cyan', 'Cyan'], ['teal', 'Teal'], ['green', 'Green'], ['orange', 'Orange'], ['pink', 'Pink'], ['purple', 'Purple'], ['gray', 'Graphite']];
const onOff = [[true, 'On'], [false, 'Off']];

/* ----- Row builders ----- */
function rowBool(key, title, desc, labels = onOff) {
  const on = !!state.settings[key];
  settingsUi.enums[key] = labels;
  return `<button class="setting-row" data-nav data-setting="${key}" data-kind="bool" role="switch" aria-checked="${on}">
    <span class="setting-text"><b class="setting-title">${title}</b>${desc ? `<small class="setting-desc">${desc}</small>` : ''}</span>
    <span class="switch${on ? ' is-on' : ''}"><i></i></span></button>`;
}

function rowEnum(key, title, desc, options) {
  settingsUi.enums[key] = options;
  const cur = options.find(([v]) => String(v) === String(state.settings[key])) || options[0];
  return `<button class="setting-row" data-nav data-setting="${key}" data-kind="enum">
    <span class="setting-text"><b class="setting-title">${title}</b>${desc ? `<small class="setting-desc">${desc}</small>` : ''}</span>
    <span class="setting-value"><i class="arrow" data-step="-1">‹</i><b>${esc(cur[1])}</b><i class="arrow" data-step="1">›</i></span></button>`;
}

function rowText(key, title, desc, placeholder, maxlength = 80) {
  return `<label class="setting-row setting-row--input">
    <span class="setting-text"><b class="setting-title">${title}</b>${desc ? `<small class="setting-desc">${desc}</small>` : ''}</span>
    <input class="input" data-nav data-text="${key}" value="${esc(state.settings[key])}" placeholder="${esc(placeholder)}" maxlength="${maxlength}" spellcheck="false"></label>`;
}

function rowAction(action, title, desc, label, { danger = false } = {}) {
  return `<div class="setting-row setting-row--action">
    <span class="setting-text"><b class="setting-title">${title}</b>${desc ? `<small class="setting-desc">${desc}</small>` : ''}</span>
    <button class="btn btn-secondary btn-sm${danger ? ' btn-danger' : ''}" data-nav data-act="${action}">${label}</button></div>`;
}

const rowInfo = (title, html, attr = '') => `<div class="setting-row setting-row--info"><span class="setting-text"><b class="setting-title">${title}</b></span><span class="setting-info" ${attr}>${html}</span></div>`;
const heading = (t) => `<h3 class="setting-heading">${t}</h3>`;
const note = (html) => `<p class="setting-note">${html}</p>`;

/* ----- Categories ----- */
const discordStatusHtml = () => {
  const d = state.discord || { status: 'off' };
  const who = d.user ? (d.user.globalName || d.user.username) : '';
  const text = {
    off: 'Off',
    'no-app-id': d.error || 'Add an Application ID to connect',
    connecting: 'Connecting…',
    waiting: `Waiting for Discord${d.error ? ` (${esc(d.error)})` : ''}`,
    connected: `Connected${who ? ` as ${esc(who)}` : ''}`,
  }[d.status] || d.status;
  return `<span class="status-line"><span class="status-dot status-dot--${d.status === 'connected' ? 'on' : d.status === 'off' ? 'off' : 'wait'}"></span>${text}</span>${d.note ? `<small>${esc(d.note)}</small>` : ''}`;
};

const panels = {
  profile() {
    const name = state.settings.profileName;
    return `
      <div class="profile-card"><span class="avatar avatar--lg" data-color="${state.settings.avatarColor}">${esc((name || '?').charAt(0).toUpperCase())}</span>
        <div><b>${esc(name || 'Player')}</b><small>${fmtDuration(totals().play)} played · ${state.games.length} ${state.games.length === 1 ? 'game' : 'games'}${state.trophies?.games ? ` · Trophy level ${state.trophies.level}` : ''}</small></div></div>
      ${rowText('profileName', 'Name', 'Shown on the Explore page.', 'Your name', 40)}
      ${rowEnum('avatarColor', 'Avatar colour', 'The circle next to the clock.', AVATAR_COLORS)}`;
  },

  library() {
    const s = state.settings;
    const folders = s.gameFolders;
    return `
      ${heading('Games folders')}
      ${note('Every folder inside these is checked for games. Drives and folders can be mixed.')}
      ${folders.length ? folders.map((f, i) => `<div class="setting-row setting-row--folder"><span class="setting-text"><b class="setting-title">${esc(f)}</b></span><button class="btn btn-ghost btn-sm" data-nav data-remove-folder="${i}">Remove</button></div>`).join('') : note('<i>No folders yet.</i>')}
      ${rowAction('add-folder', 'Add a folder', 'Pick a folder that holds your installed games.', 'Add folder')}
      ${heading('Detect games from')}
      ${rowBool('scanSteam', 'Steam', 'Reads your Steam libraries on every drive, with exact names and artwork.')}
      ${rowBool('scanEpic', 'Epic Games Store')}
      ${rowBool('scanGog', 'GOG')}
      ${rowBool('scanUbisoft', 'Ubisoft Connect')}
      ${rowBool('scanEa', 'EA app')}
      ${rowBool('scanXbox', 'Xbox and Microsoft Store', 'Looks for an XboxGames folder on every drive.')}
      ${rowText('steamPath', 'Steam folder', 'Leave empty to find it automatically.', 'C:\\Program Files (x86)\\Steam', 260)}
      ${heading('Scanning')}
      ${rowEnum('autoScan', 'Look for new games', 'Games you install later show up on their own.', [['off', 'Never'], ['startup', 'When the library starts'], ['30', 'Every 30 minutes'], ['120', 'Every 2 hours']])}
      ${rowAction('scan', 'Scan now', 'Check every folder and launcher for new games.', 'Scan for games')}
      ${rowAction('restore', 'Restore removed games', `Games you removed aren’t added again by scans. ${state.ignored ? `${state.ignored} hidden right now.` : 'Nothing is hidden.'}`, 'Restore all')}
      ${rowAction('cleanup', 'Remove missing games', 'Delete entries whose files are gone, such as uninstalled games.', 'Clean up')}
      ${heading('Artwork')}
      ${rowBool('autoArtwork', 'Download artwork for new games', 'Cover, background and logo from the game’s public Steam page.')}
      ${rowAction('art-all', 'Find artwork for all games', 'Fills in anything missing.', 'Find artwork')}`;
  },

  launcher() {
    const su = settingsUi.startup;
    return `
      ${rowBool('confirmClose', 'Ask before closing a game', 'Shown when you choose “Close game” from a running game’s options.')}
      ${rowEnum('idleExitMin', 'Stop the library when its window is closed', 'Playtime is only tracked while the library runs, so “Never” is the safest choice.', [[1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [60, 'After 1 hour'], [0, 'Never']])}
      ${su && su.available
        ? `<button class="setting-row" data-nav data-setting="__startup" data-kind="bool" role="switch" aria-checked="${su.enabled}"><span class="setting-text"><b class="setting-title">Start with Windows</b><small class="setting-desc">Opens the library when you sign in.</small></span><span class="switch${su.enabled ? ' is-on' : ''}"><i></i></span></button>`
        : rowInfo('Start with Windows', su ? 'Only available on Windows' : 'Checking…')}
      ${rowAction('add', 'Add a game by hand', 'Choose a program, a Steam App ID or a launcher link.', 'Add game')}
      ${rowAction('shortcut-help', 'Pin to the taskbar', 'Run “Create Shortcut.vbs” in the app folder once, then pin it from the Start menu.', 'Open app folder')}
      ${rowAction('quit', 'Quit the game library', 'Stops the background service. Playtime isn’t tracked until it is started again.', 'Quit', { danger: true })}`;
  },

  appearance() {
    const s = state.settings;
    return `
      ${heading('Display')}
      ${rowEnum('clock24', 'Clock', '', [[true, '24-hour'], [false, '12-hour']])}
      ${rowBool('showSeconds', 'Show seconds on the clock')}
      ${rowEnum('uiScale', 'Interface size', 'Scales text and tiles. Useful on a TV or a small screen.', [[90, 'Small'], [100, 'Default'], [115, 'Large'], [130, 'Extra large']])}
      ${rowEnum('animations', 'Animations', 'Reduced turns off the drifting symbols and shows GIF and video wallpapers as a still picture.', [['full', 'Full'], ['reduced', 'Reduced']])}
      ${rowEnum('backgroundDim', 'Background dimming', 'Darkens game art and wallpapers behind the text.', [[0, 'Off'], [20, 'Light'], [40, 'Medium'], [60, 'Strong']])}
      ${heading('Home')}
      ${rowEnum('homeOrder', 'Game order', 'How games are arranged along the home row.', [['recent', 'Recently played'], ['favorites', 'Favorites first'], ['played', 'Most played'], ['name', 'Name']])}
      ${rowEnum('startOn', 'Open on', '', [['game', 'Your latest game'], ['explore', 'Explore']])}
      ${heading('Discover wallpaper')}
      ${note('Shown behind the Explore page. Highlight a wallpaper in the chooser to preview it. Pictures, animated GIFs and short videos all work.')}
      ${rowEnum('wallpaperMode', 'Wallpaper', state.wallpapers.length ? '' : 'You haven’t added any yet.', [['scene', 'PlayStation scene'], ['single', 'My wallpaper'], ['shuffle', 'Shuffle']])}
      ${rowAction('wallpapers', 'Choose or add wallpapers', `${state.wallpapers.length} saved.`, 'Open chooser')}
      ${s.wallpaperMode === 'shuffle' ? rowEnum('wallpaperInterval', 'Change wallpaper every', '', [[1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [60, 'Hour']]) : ''}
      ${rowBool('wallpaperSymbols', 'Floating symbols over the wallpaper', 'Keeps the drifting ✕ ○ △ □ in front of your picture.')}
      ${heading('Sounds')}
      ${rowBool('sounds', 'Navigation sounds')}
      ${rowEnum('soundVolume', 'Volume', '', [[35, 'Low'], [70, 'Medium'], [100, 'High']])}`;
  },

  controller() {
    const infos = typeof padInfos === 'function' ? padInfos() : [];
    return `
      ${rowEnum('confirmButton', 'Confirm button', 'Some regions confirm with ○ and go back with ✕.', [['cross', '✕ confirms, ○ goes back'], ['circle', '○ confirms, ✕ goes back']])}
      ${rowEnum('stickDeadzone', 'Stick sensitivity', 'Raise the dead zone if the highlight drifts by itself.', [['low', 'Sensitive'], ['normal', 'Normal'], ['high', 'Relaxed']])}
      ${rowBool('rumble', 'Vibration', 'A short buzz when a game starts or a trophy is earned.')}
      ${rowEnum('lowBatteryWarn', 'Low battery warning', 'Needs a controller that reports its battery.', [[0, 'Off'], [10, 'At 10%'], [20, 'At 20%'], [30, 'At 30%']])}
      ${rowInfo('Connected', infos.length ? infos.map((p) => `${esc(p.name)}${p.battery ? ` · ${esc(batteryText(p.battery))}` : ''}`).join('<br>') : 'No controller detected')}
      ${rowAction('controllers', 'Controllers and battery', 'Check buttons and sticks, test vibration, turn on battery reading.', 'Open')}`;
  },

  playtime() {
    return `
      ${rowEnum('weeklyGoalHours', 'Weekly playtime goal', 'Shown as a ring on the Stats screen.', [[0, 'No goal'], [5, '5 hours'], [10, '10 hours'], [20, '20 hours'], [40, '40 hours']])}
      ${rowEnum('weekStartsOn', 'Week starts on', '', [['mon', 'Monday'], ['sun', 'Sunday']])}
      ${rowEnum('minSessionSec', 'Ignore short sessions', 'A launch that ends sooner than this isn’t recorded.', [[5, 'Under 5 seconds'], [60, 'Under 1 minute'], [300, 'Under 5 minutes']])}
      ${rowBool('trophyPopups', 'Trophy pop-ups', 'The banner and chime when you tick off a trophy.')}`;
  },

  discord() {
    const s = state.settings;
    return `
      ${note('Shows what you are playing on your Discord profile for games that don’t do it themselves. Discord must be running on this PC.')}
      ${rowBool('discordEnabled', 'Show my game on Discord')}
      ${rowInfo('Status', discordStatusHtml(), 'data-discord-status')}
      ${rowText('discordAppId', 'Application ID', 'Create a free application at discord.com/developers, then paste its ID. Its name is what Discord shows after “Playing”.', '123456789012345678', 24)}
      ${rowAction('discord-dev', 'Open the Discord developer page', 'Click New Application, name it, then copy the Application ID.', 'Open page')}
      ${rowBool('discordSkipDetected', 'Skip games Discord already recognises', 'Discord detects many games on its own. This avoids showing them twice.')}
      ${rowBool('discordShowCover', 'Show the game’s cover', 'Works for games with a Steam App ID.')}
      ${rowBool('discordShowTime', 'Show elapsed time')}
      ${rowBool('discordShowTrophies', 'Show trophy progress')}
      ${rowBool('discordIdle', 'Show “Browsing the library” when no game is running')}
      ${note('You can also choose Always or Never for a single game in its Edit details.')}`;
  },

  data() {
    return `
      ${rowAction('export', 'Export a backup', 'Saves your playtime, trophies, notes, ratings and settings as a file.', 'Export')}
      ${rowAction('import', 'Restore from a backup', 'Merges a backup file into this library. Nothing is deleted.', 'Choose file')}
      ${rowAction('open-data', 'Open the data folder', 'Where the library, artwork and wallpapers are stored.', 'Open folder')}`;
  },

  about() {
    return `
      ${heading('Controls')}
      <dl class="controls">
        <dt>✕ / A · Enter</dt><dd>Select, launch game</dd>
        <dt>○ / B · Esc</dt><dd>Back</dd>
        <dt>□ / X · O</dt><dd>Options for the highlighted game (wallpapers on Explore)</dd>
        <dt>△ / Y · /</dt><dd>Search</dd>
        <dt>L1 / R1 · Q / E</dt><dd>Switch between Games, Library and Stats</dd>
        <dt>Options / Start</dt><dd>Settings</dd>
        <dt>Right stick</dt><dd>Scroll</dd>
        <dt>F11</dt><dd>Toggle full screen</dd>
      </dl>
      ${heading('This library')}
      ${rowInfo('Games', String(state.games.length))}
      ${rowInfo('Playtime recorded', fmtDuration(totals().play))}
      ${rowInfo('Trophies earned', state.trophies ? `${Object.values(state.trophies.unlocked).reduce((a, b) => a + b, 0)}` : '0')}
      ${note('Artwork and trophy lists come from public Steam pages. Nothing else leaves your PC, apart from your Discord status if you turn it on.')}`;
  },
};

/* ----- Rendering ----- */
function renderSettingsView() {
  const root = $('#view-settings');
  root.innerHTML = `
    <nav class="settings-rail" aria-label="Settings categories">
      <h1 class="library-title">Settings</h1>
      ${CATEGORIES.map(([id, label, icon]) => `<button class="rail-item${id === settingsUi.cat ? ' is-active' : ''}" data-nav data-cat="${id}">${icon}<span>${label}</span></button>`).join('')}
    </nav>
    <div class="settings-panel" id="settings-panel"></div>`;
  paintSettingsPanel();
  if (settingsUi.cat === 'launcher' && !settingsUi.startup) loadStartup();
}

function paintSettingsPanel(keepKey) {
  const panel = $('#settings-panel');
  if (!panel) return;
  const scroll = panel.scrollTop;
  const focusKey = keepKey ?? (panel.contains(document.activeElement) ? (document.activeElement.dataset.setting || document.activeElement.dataset.text || document.activeElement.dataset.act || document.activeElement.dataset.removeFolder) : null);
  settingsUi.enums = {};
  const cat = CATEGORIES.find(([id]) => id === settingsUi.cat);
  panel.innerHTML = `<h2 class="settings-title">${cat[2]}${cat[1]}</h2>${panels[settingsUi.cat]()}`;
  panel.scrollTop = scroll;
  if (focusKey) {
    const el = panel.querySelector(`[data-setting="${focusKey}"], [data-text="${focusKey}"], [data-act="${focusKey}"], [data-remove-folder="${focusKey}"]`);
    el?.focus({ preventScroll: true });
  }
}

function openSettingsCategory(id, { focus = true } = {}) {
  if (!CATEGORIES.some(([c]) => c === id)) return;
  const changed = settingsUi.cat !== id;
  settingsUi.cat = id;
  if (state.view !== 'settings') return setView('settings', { focus });
  $$('.rail-item').forEach((b) => b.classList.toggle('is-active', b.dataset.cat === id));
  if (changed) paintSettingsPanel();
  if (id === 'launcher' && !settingsUi.startup) loadStartup();
  if (focus) focusEl($(`.rail-item[data-cat="${id}"]`));
}

async function loadStartup() {
  try { settingsUi.startup = await api('/api/startup'); } catch { settingsUi.startup = { available: false, enabled: false }; }
  if (state.view === 'settings' && settingsUi.cat === 'launcher') paintSettingsPanel();
}

async function saveSetting(patch, keepKey) {
  try {
    state.settings = await api('/api/settings', { method: 'POST', json: patch });
    applyPreferences();
    tickClock();
    renderAvatar();
    renderStage();
    renderCarousel();
    renderControllerButton();
    paintSettingsPanel(keepKey);
    return true;
  } catch (e) {
    toast(e.message, 5000);
    paintSettingsPanel(keepKey);
    return false;
  }
}

// Steps an option row to its neighbour. Returns false when already at the end (unless wrapping).
function stepEnum(key, delta, wrap) {
  const options = settingsUi.enums[key];
  if (!options) return false;
  let i = options.findIndex(([v]) => String(v) === String(state.settings[key]));
  if (i < 0) i = 0;
  let next = i + delta;
  if (next < 0 || next >= options.length) {
    if (!wrap) return false;
    next = (next + options.length) % options.length;
  }
  saveSetting({ [key]: options[next][0] }, key);
  return true;
}

async function toggleStartup() {
  const want = !settingsUi.startup?.enabled;
  try {
    settingsUi.startup = await api('/api/startup', { method: 'POST', json: { enabled: want } });
    toast(want ? 'The library will start with Windows' : 'No longer starts with Windows');
  } catch (e) { toast(e.message, 5000); }
  paintSettingsPanel('__startup');
}

/* ----- Events ----- */
(function wireSettings() {
  const root = $('#view-settings');

  root.addEventListener('focusin', (e) => {
    const rail = e.target.closest('.rail-item');
    if (rail && rail.dataset.cat !== settingsUi.cat) {
      settingsUi.cat = rail.dataset.cat;
      $$('.rail-item').forEach((b) => b.classList.toggle('is-active', b === rail));
      paintSettingsPanel();
      if (settingsUi.cat === 'launcher' && !settingsUi.startup) loadStartup();
    }
  });

  root.addEventListener('click', async (e) => {
    const rail = e.target.closest('.rail-item');
    if (rail) return openSettingsCategory(rail.dataset.cat, { focus: false });

    const row = e.target.closest('.setting-row[data-setting]');
    if (row) {
      const key = row.dataset.setting;
      if (key === '__startup') return toggleStartup();
      if (row.dataset.kind === 'bool') return void saveSetting({ [key]: !state.settings[key] }, key);
      const arrow = e.target.closest('.arrow');
      return void stepEnum(key, arrow ? Number(arrow.dataset.step) : 1, !arrow);
    }

    const rm = e.target.closest('[data-remove-folder]');
    if (rm) {
      const folders = state.settings.gameFolders.filter((_, i) => i !== Number(rm.dataset.removeFolder));
      return void saveSetting({ gameFolders: folders });
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    try {
      if (act === 'add-folder') {
        const p = await browseDialog({ title: 'Choose a games folder', filter: 'dir', start: state.settings.gameFolders[0] || '' });
        if (p && await saveSetting({ gameFolders: [...new Set([...state.settings.gameFolders, p])] }, 'add-folder')) scanFolder();
      }
      if (act === 'scan') await scanFolder();
      if (act === 'restore') {
        const r = await api('/api/restore-removed', { method: 'POST' });
        await refresh();
        toast(r.restored ? `${r.restored} removed ${r.restored === 1 ? 'game' : 'games'} can be found again. Scanning…` : 'Nothing to restore');
        if (r.restored) scanFolder();
      }
      if (act === 'cleanup') {
        const missing = state.games.filter((g) => !g.exeExists && g.status !== 'running');
        if (!missing.length) return toast('No missing games');
        if (!(await confirmDialog('Remove missing games?', `${missing.length} ${missing.length === 1 ? 'game has' : 'games have'} lost their files: ${missing.slice(0, 4).map((g) => g.name).join(', ')}${missing.length > 4 ? '…' : ''}. Their playtime and notes are deleted too.`, 'Remove'))) return;
        const r = await api('/api/cleanup-missing', { method: 'POST' });
        await refresh();
        toast(`Removed ${r.removed.length} ${r.removed.length === 1 ? 'game' : 'games'}`);
      }
      if (act === 'art-all') {
        const { queued } = await api('/api/artwork/auto', { method: 'POST', json: {} });
        toast(queued ? `Finding artwork for ${queued} ${queued === 1 ? 'game' : 'games'}…` : 'Every game already has artwork');
        if (queued) watchArtwork();
      }
      if (act === 'add') openGameEditor(null);
      if (act === 'shortcut-help') await api('/api/open-data', { method: 'POST' }).then(() => toast('Opened the data folder. “Create Shortcut.vbs” is in the app folder next to it.', 6000));
      if (act === 'wallpapers') openWallpaperMenu();
      if (act === 'controllers') openControllers();
      if (act === 'discord-dev') window.open('https://discord.com/developers/applications', '_blank', 'noopener');
      if (act === 'export') {
        const a = document.createElement('a');
        a.href = '/api/export';
        a.download = '';
        a.click();
        toast('Backup saved to your Downloads folder');
      }
      if (act === 'import') {
        const file = await chooseFile('.json,application/json');
        if (!file) return;
        const r = await api('/api/import', { method: 'POST', json: JSON.parse(await file.text()) });
        await refresh();
        toast(`Restored: ${r.matched} games updated, ${r.added} added, ${r.sessions} sessions`, 6000);
      }
      if (act === 'open-data') await api('/api/open-data', { method: 'POST' });
      if (act === 'quit' && await confirmDialog('Quit the game library?', 'Playtime is only tracked while the library is running.', 'Quit')) {
        await api('/api/quit', { method: 'POST' }).catch(() => {});
        window.close();
        document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font-weight:300;font-size:1.75rem">You can close this window.</div>';
      }
    } catch (err) {
      toast(err.message, 5000);
    }
  });

  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-text]');
    if (!el) return;
    const key = el.dataset.text;
    if (el.value.trim() === String(state.settings[key] ?? '')) return;
    saveSetting({ [key]: el.value }, key);
  });
})();

/* ----- Controller navigation inside Settings ----- */
navHooks.push((dir, cur, layer, { go, repeat }) => {
  if (layer || state.view !== 'settings' || !cur) return false;
  const rail = cur.closest('.settings-rail');
  const panel = cur.closest('.settings-panel');
  const activeRail = () => $('.rail-item.is-active');
  if (rail) {
    if (dir === 'right') { go($('#settings-panel [data-nav]')); return true; }
    if (dir === 'left') { if (!repeat) sfx.bump(); return true; }
    return false;
  }
  if (panel) {
    const key = cur.dataset.setting;
    if (cur.dataset.kind === 'enum' && (dir === 'left' || dir === 'right')) {
      if (stepEnum(key, dir === 'right' ? 1 : -1, false)) sfx.move();
      else if (dir === 'left') go(activeRail());
      else if (!repeat) sfx.bump();
      return true;
    }
    if (cur.dataset.kind === 'bool' && (dir === 'left' || dir === 'right')) {
      const want = dir === 'right';
      const isOn = key === '__startup' ? !!settingsUi.startup?.enabled : !!state.settings[key];
      if (want !== isOn && dir === 'right') { if (key === '__startup') toggleStartup(); else saveSetting({ [key]: true }, key); sfx.move(); }
      else if (dir === 'left' && isOn) { if (key === '__startup') toggleStartup(); else saveSetting({ [key]: false }, key); sfx.move(); }
      else if (dir === 'left') go(activeRail());
      else if (!repeat) sfx.bump();
      return true;
    }
    if (dir === 'left') {
      const best = nearest(cur, focusables($('#settings-panel')), 'left');
      if (!best) { go(activeRail()); return true; }
    }
  }
  return false;
});

/* ----- Avatar and live updates ----- */
function renderAvatar() {
  const el = $('#btn-avatar');
  const name = state.settings.profileName;
  el.dataset.color = state.settings.avatarColor;
  el.textContent = (name || '?').charAt(0).toUpperCase();
  el.title = name || 'Profile';
}

refreshHooks.push(renderAvatar, () => {
  if (state.view !== 'settings') return;
  // Keep the Discord status line live without rebuilding the panel under the player's focus.
  const el = $('[data-discord-status]');
  if (el) el.innerHTML = discordStatusHtml();
  if (settingsUi.cat === 'library' || settingsUi.cat === 'controller') {
    const sig = JSON.stringify([state.ignored, state.wallpapers.length, state.settings.gameFolders]);
    if (settingsUi.sig !== sig) { settingsUi.sig = sig; paintSettingsPanel(); }
  }
});
