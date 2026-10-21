'use strict';
/* ======================= Discover wallpaper ======================= */
// The Explore tile can show your own wallpaper (image, animated GIF or video) instead of the floating symbols.
// Highlighting a wallpaper in the picker previews it live behind the picker.

function previewingWallpaper() {
  const p = state.wallpaperPreview;
  return p && p !== 'scene';
}

// The wallpaper the Explore page should show right now, or null for the PlayStation symbols scene.
function activeWallpaper() {
  if (state.wallpaperPreview === 'scene') return null;
  if (state.wallpaperPreview) return state.wallpaperPreview;
  const s = state.settings, list = state.wallpapers;
  if (!list.length || s.wallpaperMode === 'scene') return null;
  if (s.wallpaperMode === 'single') return list.find((w) => w.id === s.wallpaperId) || null;
  const slot = Math.floor(Date.now() / (s.wallpaperInterval * 60000));
  return list[slot % list.length];
}

function previewWallpaper(w) {
  const next = w === null ? undefined : w;
  if (state.wallpaperPreview === next) return;
  state.wallpaperPreview = next;
  updateBackdrop();
}

const stillFrames = new Map();
function stillFrame(url) {
  if (stillFrames.has(url)) return stillFrames.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.9));
      } catch { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
  stillFrames.set(url, p);
  return p;
}

/* ----- Adding wallpapers ----- */
async function addWallpaper() {
  const how = await listDialog('Add a wallpaper', [
    ['pc', ICON.folder, 'Browse this PC', 'Pictures, GIFs and short videos'],
    ['url', ICON.search, 'From a link', 'Paste the address of an image, GIF or video'],
    ['file', ICON.image, 'Upload a file', 'Pick one with the system file chooser'],
  ]);
  if (!how) return null;
  try {
    let w = null;
    if (how === 'pc') {
      const path = await browseDialog({ title: 'Choose a wallpaper', filter: 'wallpaper', start: state.settings.gamesRoot });
      if (!path) return null;
      toast('Adding wallpaper…', 10000);
      w = await api('/api/wallpapers', { method: 'POST', json: { path } });
    } else if (how === 'url') {
      const url = await promptDialog('Wallpaper link', 'Link to a JPG, PNG, WebP, GIF, MP4 or WebM', '', 'https://…');
      if (!url) return null;
      toast('Downloading wallpaper…', 20000);
      w = await api('/api/wallpapers', { method: 'POST', json: { url } });
    } else {
      const file = await chooseFile('image/*,video/mp4,video/webm');
      if (!file) return null;
      toast('Adding wallpaper…', 10000);
      w = await uploadWallpaper(file);
    }
    return await afterWallpaperAdded(w);
  } catch (e) {
    toast(e.message, 6000);
    return null;
  }
}

function chooseFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

function uploadWallpaper(file) {
  return api('/api/wallpapers', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'image/png', 'X-Name': encodeURIComponent(file.name.replace(/\.\w+$/, '')) } });
}

async function afterWallpaperAdded(w) {
  await api('/api/settings', { method: 'POST', json: { wallpaperMode: 'single', wallpaperId: w.id } });
  await refresh();
  toast(`${w.name} is now your Discover wallpaper`);
  return w;
}

async function applyWallpaper(w) {
  await api('/api/settings', { method: 'POST', json: w ? { wallpaperMode: 'single', wallpaperId: w.id } : { wallpaperMode: 'scene' } });
  await refresh();
}

/* ----- The picker: a strip of thumbnails along the bottom ----- */
function wallpaperThumb(w) {
  if (w.type === 'video') return `<video src="${esc(w.url)}#t=0.6" muted playsinline preload="metadata"></video>`;
  return `<img src="${esc(w.url)}" alt="" loading="lazy">`;
}

function openWallpaperMenu() {
  const s = state.settings;
  const current = s.wallpaperMode === 'single' ? s.wallpaperId : s.wallpaperMode === 'shuffle' ? '__shuffle' : '';
  const card = (key, inner, label, active) => `<button class="wp-card${active ? ' is-current' : ''}" data-nav data-wp="${key}" aria-label="${esc(label)}">${inner}<span class="wp-name">${esc(label)}</span>${active ? `<i class="wp-badge">${ICON.check}</i>` : ''}</button>`;
  const cards = () => [
    card('', '<span class="wp-default">' + ICON.explore + '</span>', 'PlayStation scene', current === '' && s.wallpaperMode === 'scene'),
    ...state.wallpapers.map((w) => card(w.id, wallpaperThumb(w), w.name, current === w.id)),
    state.wallpapers.length > 1 ? card('__shuffle', `<span class="wp-default">${ICON.shuffle}</span>`, `Shuffle every ${s.wallpaperInterval} min`, current === '__shuffle') : '',
    card('__add', `<span class="wp-default">${ICON.plus}</span>`, 'Add wallpaper', false),
  ].join('');

  const layer = openLayer(`
    <div class="wp-picker" role="dialog" aria-label="Discover wallpaper">
      <h2>Discover wallpaper</h2>
      <p class="muted">Highlight one to preview it. ${state.settings.confirmButton === 'circle' ? '○' : '✕'} to apply, □ to remove.</p>
      <div class="wp-strip" data-strip>${cards()}</div>
    </div>`, {
    className: 'layer-peek',
    onClose: () => previewWallpaper(null),
    actions: {
      options: async () => {
        const id = document.activeElement?.dataset.wp;
        const w = state.wallpapers.find((x) => x.id === id);
        if (!w || !(await confirmDialog('Remove wallpaper?', `${w.name} will be deleted from the library’s wallpapers.`, 'Remove'))) return;
        await api(`/api/wallpapers/${w.id}`, { method: 'DELETE' });
        await refresh();
        layer.querySelector('[data-strip]').innerHTML = cards();
        focusEl(layer.querySelector('[data-wp]'));
      },
    },
  });
  const strip = layer.querySelector('[data-strip]');
  const preview = (el) => {
    const key = el?.dataset.wp;
    if (key === undefined) return;
    if (key === '__add') return previewWallpaper(null);
    if (key === '__shuffle') return previewWallpaper(state.wallpapers[0] || null);
    previewWallpaper(key === '' ? 'scene' : state.wallpapers.find((w) => w.id === key) || null);
  };
  strip.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-wp]');
    preview(el);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
  strip.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-wp]'); if (el) preview(el); });
  strip.addEventListener('mouseleave', () => previewWallpaper(null));
  strip.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-wp]');
    if (!el) return;
    const key = el.dataset.wp;
    try {
      if (key === '__add') {
        previewWallpaper(null);
        const w = await addWallpaper();
        if (w) { strip.innerHTML = cards(); closeLayer(layer); }
        return;
      }
      if (key === '__shuffle') await api('/api/settings', { method: 'POST', json: { wallpaperMode: 'shuffle' } }), await refresh();
      else await applyWallpaper(state.wallpapers.find((w) => w.id === key) || null);
      toast(key === '' ? 'Using the PlayStation scene' : key === '__shuffle' ? 'Shuffling your wallpapers' : 'Wallpaper applied');
      closeLayer(layer);
    } catch (err) { toast(err.message); }
  });
  layer.addEventListener('dragover', (e) => e.preventDefault());
  layer.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => /^(image|video)\//.test(f.type));
    if (!file) return;
    try { toast('Adding wallpaper…', 10000); await afterWallpaperAdded(await uploadWallpaper(file)); closeLayer(layer); } catch (err) { toast(err.message, 6000); }
  });
  requestAnimationFrame(() => {
    const cur = strip.querySelector('.is-current') || strip.querySelector('[data-wp]');
    focusEl(cur);
  });
}

/* ----- Keep things moving ----- */
// Shuffle: move on to the next wallpaper when the interval rolls over.
setInterval(() => {
  if (state.settings.wallpaperMode !== 'shuffle' || state.wallpaperPreview) return;
  if (state.view === 'home' && state.selectedId === EXPLORE_ID) updateBackdrop();
}, 20000);

// Pause a video wallpaper while the window isn't in use.
function syncVideo() {
  if (!bgVideo.classList.contains('is-visible')) return;
  if (document.documentElement.classList.contains('is-idle') || state.settings.animations === 'reduced') bgVideo.pause();
  else bgVideo.play().catch(() => {});
}
window.addEventListener('blur', () => setTimeout(syncVideo, 0));
window.addEventListener('focus', () => setTimeout(syncVideo, 0));
document.addEventListener('visibilitychange', () => setTimeout(syncVideo, 0));

// A wallpaper that was removed or changed in Settings applies the next time the state arrives.
refreshHooks.push(() => {
  if (state.view === 'home' && state.selectedId === EXPLORE_ID) {
    const w = activeWallpaper();
    const want = w ? `wall:${w.id}:${state.settings.wallpaperSymbols ? 1 : 0}` : 'scene:full';
    if (backdrop.key !== want) updateBackdrop();
  }
});
