'use strict';
/* ======================= Trophies and notes ======================= */

/* ----- Trophy popup (the banner that drops from the top when one is earned) ----- */
const trophyQueue = [];
let trophyShowing = false;

function showTrophyPopup(ach, gameName, platinum = false) {
  if (!state.settings.trophyPopups) return;
  trophyQueue.push({ ach, gameName, platinum });
  if (!trophyShowing) nextTrophyPopup();
}

function nextTrophyPopup() {
  const item = trophyQueue.shift();
  const el = $('#trophy-pop');
  if (!item) { trophyShowing = false; return; }
  trophyShowing = true;
  const tier = item.platinum ? 'platinum' : item.ach.tier;
  el.innerHTML = `
    <div class="trophy-card tier--${tier}">
      ${tierIcon(tier, 'trophy-card-icon')}
      <div class="trophy-card-text">
        <small>${item.platinum ? 'Platinum trophy earned' : `${TIER_LABEL[tier]} trophy earned`}</small>
        <b>${esc(item.platinum ? `${item.gameName} 100%` : item.ach.title)}</b>
        <span>${esc(item.gameName)}</span>
      </div>
    </div>`;
  el.classList.add('is-visible');
  (item.platinum ? sfx.platinum : sfx.trophy)();
  rumble(0.2, 0.5, 220);
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(nextTrophyPopup, 500);
  }, item.platinum ? 5600 : 4200);
}

/* ----- Trophy list ----- */
function trophyRowHtml(a) {
  const icon = a.icon ? `<img class="tr-icon" src="${esc(a.icon)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'tr-icon tr-icon--none',innerHTML:this.dataset.fallback}))" data-fallback="${esc(ICON.cup)}">` : `<span class="tr-icon tr-icon--none">${ICON.cup}</span>`;
  return `
    <div class="trophy-row tier--${a.tier}${a.unlockedAt ? ' is-unlocked' : ''}" data-row="${a.id}">
      <button class="tr-main" data-nav data-toggle="${a.id}" aria-pressed="${a.unlockedAt ? 'true' : 'false'}">
        <span class="tr-art">${icon}</span>
        <span class="tr-text"><b>${esc(a.title)}</b><small>${esc(a.description || 'No description')}</small></span>
        <span class="tr-side">
          ${tierIcon(a.tier)}
          <small>${a.unlockedAt ? fmtDate(a.unlockedAt) : a.percent != null ? `${a.percent.toFixed(a.percent < 10 ? 1 : 0)}% of players` : TIER_LABEL[a.tier]}</small>
        </span>
        <span class="tr-check">${a.unlockedAt ? ICON.check : ''}</span>
      </button>
      <button class="tr-edit" data-nav data-edit="${a.id}" aria-label="Edit trophy">${ICON.more}</button>
    </div>`;
}

async function openTrophies(id) {
  const g = byId(id);
  if (!g) return;
  let data = { list: [], summary: null };
  let filter = 'all';
  const layer = openLayer(`
    <div class="modal modal-wide trophies" role="dialog" aria-label="${esc(g.name)} trophies">
      <div class="tr-head" data-head></div>
      <div class="tr-toolbar">
        <div class="chips" data-filters>
          ${[['all', 'All'], ['locked', 'Locked'], ['unlocked', 'Earned']].map(([k, l]) => `<button class="chip${k === 'all' ? ' is-active' : ''}" data-nav data-f="${k}">${l}</button>`).join('')}
        </div>
        <div class="tr-actions">
          <button class="btn btn-secondary btn-sm" data-nav data-act="add">${ICON.plus}Add</button>
          <button class="btn btn-secondary btn-sm" data-nav data-act="import">Import from Steam</button>
          <button class="btn btn-ghost btn-sm" data-nav data-act="more">${ICON.more}</button>
        </div>
      </div>
      <div class="tr-list" data-list></div>
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-act="done">Done</button></div>
    </div>`, {
    actions: { options: () => { const row = document.activeElement?.closest('.trophy-row'); if (row) editTrophy(row.dataset.row); } },
  });

  const head = layer.querySelector('[data-head]');
  const list = layer.querySelector('[data-list]');

  function paint(keepFocusId) {
    const sum = data.summary;
    head.innerHTML = `
      <div class="tr-title"><h2>${esc(g.name)}</h2><p class="muted">${sum && sum.total ? `${sum.done} of ${sum.total} earned` : 'No trophies yet'}</p></div>
      ${sum && sum.total ? `
        <div class="tr-summary">
          <div class="tr-ring">${gaugeHtml([{ value: sum.done, color: sum.platinum ? '#9fd8ff' : '#53b1ff' }], sum.total, `${sum.percent}%`, sum.platinum ? 'Platinum' : 'Complete')}</div>
          <div class="tr-tiers">
            ${['platinum', 'gold', 'silver', 'bronze'].map((k) => `<div class="tr-tier tier--${k}">${tierIcon(k)}<b>${k === 'platinum' ? (sum.platinum ? 1 : 0) : sum.unlocked[k]}</b><small>${k === 'platinum' ? (sum.platinumPossible === false ? '–' : '/ 1') : `/ ${sum.counts[k]}`}</small></div>`).join('')}
            <div class="tr-points"><b>${sum.points.toLocaleString()}</b><small>points</small></div>
          </div>
        </div>` : ''}`;
    const shown = data.list.filter((a) => filter === 'all' || (filter === 'locked') === !a.unlockedAt);
    list.innerHTML = shown.length
      ? shown.map(trophyRowHtml).join('')
      : `<div class="empty"><h2>${data.list.length ? 'Nothing here' : 'No trophies yet'}</h2><p class="muted">${data.list.length ? 'No trophies match this filter.' : 'Import the official list from Steam, or add your own goals and tick them off as you go.'}</p></div>`;
    if (keepFocusId) list.querySelector(`[data-toggle="${keepFocusId}"]`)?.focus({ preventScroll: true });
  }

  async function load() {
    try { data = await api(`/api/games/${id}/achievements`); } catch (e) { toast(e.message); }
    paint();
  }

  async function toggle(aid) {
    const a = data.list.find((x) => x.id === aid);
    if (!a) return;
    try {
      const r = await api(`/api/games/${id}/achievements/${aid}`, { method: 'PATCH', json: { unlocked: !a.unlockedAt } });
      data = r;
      paint(aid);
      if (r.unlockedNow) { showTrophyPopup(r.achievement, g.name); if (r.platinumNow) showTrophyPopup(r.achievement, g.name, true); }
      else sfx.back();
      refresh();
    } catch (e) { toast(e.message); }
  }

  async function editTrophy(aid) {
    const a = aid ? data.list.find((x) => x.id === aid) : null;
    const res = await trophyEditor(a);
    if (!res) return;
    try {
      if (res.delete) data = await api(`/api/games/${id}/achievements/${aid}`, { method: 'DELETE' });
      else if (a) data = await api(`/api/games/${id}/achievements/${aid}`, { method: 'PATCH', json: res });
      else data = await api(`/api/games/${id}/achievements`, { method: 'POST', json: res });
      paint(aid);
      refresh();
    } catch (e) { toast(e.message); }
  }

  async function importSteam() {
    let appid = g.steamAppId;
    if (!appid) {
      const v = await promptDialog('Steam App ID', 'Find it in the game’s Steam store address, e.g. store.steampowered.com/app/1145360', '', '1145360');
      if (!v) return;
      appid = Number(v);
    }
    toast('Importing trophies from Steam…', 8000);
    try {
      const r = await api(`/api/games/${id}/achievements/import-steam`, { method: 'POST', json: { appid } });
      data = r;
      paint();
      refresh();
      toast(r.added ? `Imported ${r.added} ${r.added === 1 ? 'trophy' : 'trophies'}` : 'Already up to date');
    } catch (e) { toast(e.message, 6000); }
  }

  layer.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.toggle) return toggle(t.dataset.toggle);
    if (t.dataset.edit) return editTrophy(t.dataset.edit);
    if (t.dataset.f) {
      filter = t.dataset.f;
      $$('[data-f]', layer).forEach((c) => c.classList.toggle('is-active', c === t));
      return paint();
    }
    const act = t.dataset.act;
    if (act === 'done') closeLayer(layer);
    if (act === 'add') editTrophy(null);
    if (act === 'import') importSteam();
    if (act === 'more') {
      const choice = await listDialog('Trophy list', [
        ['reset', ICON.reset, 'Reset progress', 'Mark every trophy as not earned'],
        ['clear', ICON.trash, 'Remove all trophies', 'Delete the whole list'],
      ]);
      if (choice === 'reset' && await confirmDialog('Reset progress?', 'Every trophy for this game will be marked as not earned.', 'Reset')) {
        data = await api(`/api/games/${id}/achievements/reset`, { method: 'POST' }); paint(); refresh();
      }
      if (choice === 'clear' && await confirmDialog('Remove all trophies?', 'The whole trophy list for this game will be deleted.', 'Remove')) {
        data = await api(`/api/games/${id}/achievements/clear`, { method: 'POST' }); paint(); refresh();
      }
    }
  });
  await load();
  if (data.list.length) focusEl(list.querySelector('[data-toggle]'));
}

function trophyEditor(a) {
  return new Promise((resolve) => {
    let tier = a?.tier || 'bronze';
    const layer = openLayer(`
      <div class="modal" role="dialog" aria-label="${a ? 'Edit trophy' : 'Add trophy'}">
        <h2>${a ? 'Edit trophy' : 'Add trophy'}</h2>
        <label class="field"><span>Name</span><input class="input" data-nav data-f="title" autofocus value="${esc(a?.title)}" placeholder="e.g. Beat the final boss" maxlength="120"></label>
        <label class="field"><span>Description (optional)</span><input class="input" data-nav data-f="description" value="${esc(a?.description)}" placeholder="How to earn it" maxlength="400"></label>
        <div class="field"><span>Grade</span>
          <div class="chips" data-tier>${['bronze', 'silver', 'gold'].map((k) => `<button class="chip${tier === k ? ' is-active' : ''}" data-nav data-t="${k}">${TIER_LABEL[k]}</button>`).join('')}</div></div>
        <p class="form-error" data-error></p>
        <div class="modal-actions">
          ${a ? '<button class="btn btn-ghost spacer" data-nav data-delete>Delete</button>' : ''}
          <button class="btn btn-secondary" data-nav data-cancel>Cancel</button>
          <button class="btn btn-primary" data-nav data-save>Save</button>
        </div>
      </div>`, { onClose: (r) => resolve(r ?? null) });
    layer.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.t) { tier = t.dataset.t; $$('[data-t]', layer).forEach((c) => c.classList.toggle('is-active', c === t)); }
      else if (t.hasAttribute('data-cancel')) closeLayer(layer);
      else if (t.hasAttribute('data-delete')) closeLayer(layer, { delete: true });
      else if (t.hasAttribute('data-save')) {
        const title = layer.querySelector('[data-f="title"]').value.trim();
        if (!title) { layer.querySelector('[data-error]').textContent = 'Give the trophy a name.'; return; }
        closeLayer(layer, { title, description: layer.querySelector('[data-f="description"]').value.trim(), tier });
      }
    });
  });
}

// A small list of choices; resolves with the chosen key.
function listDialog(title, items) {
  return new Promise((resolve) => {
    const layer = openLayer(`
      <div class="modal menu" role="dialog" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2>
        ${items.map(([k, icon, label, sub]) => `<button class="menu-item" data-nav data-pick="${k}">${icon}<span class="item-text">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`).join('')}
      </div>`, { onClose: (r) => resolve(r ?? null) });
    layer.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) closeLayer(layer, b.dataset.pick); });
  });
}

/* ----- Notes ----- */
async function openNotes(id) {
  const g = byId(id);
  if (!g) return;
  let notes = [];
  const layer = openLayer(`
    <div class="modal modal-notes" role="dialog" aria-label="${esc(g.name)} notes">
      <div class="notes-head"><div><h2>Notes</h2><p class="muted">${esc(g.name)}</p></div>
        <button class="btn btn-primary btn-sm" data-nav data-new>${ICON.plus}New note</button></div>
      <div class="notes-list" data-list></div>
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-done>Done</button></div>
    </div>`);
  const list = layer.querySelector('[data-list]');

  function paint(focusId) {
    list.innerHTML = notes.length
      ? notes.map((n) => `
        <button class="note-card${n.pinned ? ' is-pinned' : ''}" data-nav data-note="${n.id}">
          <span class="note-text">${esc(n.text)}</span>
          <span class="note-meta">${n.pinned ? `${ICON.pin}Pinned · ` : ''}${n.updatedAt !== n.createdAt ? 'Edited ' : ''}${fmtRelative(n.updatedAt)}</span>
        </button>`).join('')
      : `<div class="empty"><h2>No notes yet</h2><p class="muted">Jot down boss tips, where you left off, codes, or anything you want to remember.</p></div>`;
    if (focusId) list.querySelector(`[data-note="${focusId}"]`)?.focus({ preventScroll: true });
  }
  async function load(focusId) {
    try { notes = await api(`/api/games/${id}/notes`); } catch (e) { toast(e.message); }
    paint(focusId);
    refresh();
  }

  layer.addEventListener('click', async (e) => {
    if (e.target.closest('[data-done]')) return closeLayer(layer);
    const card = e.target.closest('[data-note]');
    if (e.target.closest('[data-new]') || card) {
      const note = card ? notes.find((n) => n.id === card.dataset.note) : null;
      const r = await noteEditor(note);
      if (!r) return;
      try {
        if (r.delete) await api(`/api/games/${id}/notes/${note.id}`, { method: 'DELETE' });
        else if (note) await api(`/api/games/${id}/notes/${note.id}`, { method: 'PATCH', json: r });
        else await api(`/api/games/${id}/notes`, { method: 'POST', json: r });
        await load(note?.id);
      } catch (err) { toast(err.message); }
    }
  });
  await load();
  focusEl(list.querySelector('[data-note]') || layer.querySelector('[data-new]'));
}

function noteEditor(note) {
  return new Promise((resolve) => {
    let pinned = !!note?.pinned;
    const layer = openLayer(`
      <div class="modal" role="dialog" aria-label="${note ? 'Edit note' : 'New note'}">
        <h2>${note ? 'Edit note' : 'New note'}</h2>
        <label class="field"><span>Note</span><textarea class="input textarea" data-nav data-text autofocus maxlength="20000" placeholder="Write something…">${esc(note?.text)}</textarea></label>
        <div class="field"><span>Pin</span><div class="chips"><button class="chip${pinned ? ' is-active' : ''}" data-nav data-pin>${ICON.pin}Show on the game’s page</button></div></div>
        <p class="form-error" data-error></p>
        <div class="modal-actions">
          ${note ? '<button class="btn btn-ghost spacer" data-nav data-delete>Delete</button>' : ''}
          <button class="btn btn-secondary" data-nav data-cancel>Cancel</button>
          <button class="btn btn-primary" data-nav data-save>Save</button>
        </div>
      </div>`, { onClose: (r) => resolve(r ?? null) });
    const text = layer.querySelector('[data-text]');
    layer.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-pin')) { pinned = !pinned; t.classList.toggle('is-active', pinned); }
      else if (t.hasAttribute('data-cancel')) closeLayer(layer);
      else if (t.hasAttribute('data-delete')) { if (await confirmDialog('Delete this note?', 'This can’t be undone.', 'Delete')) closeLayer(layer, { delete: true }); }
      else if (t.hasAttribute('data-save')) {
        if (!text.value.trim()) { layer.querySelector('[data-error]').textContent = 'Write something first.'; return; }
        closeLayer(layer, { text: text.value, pinned });
      }
    });
  });
}
