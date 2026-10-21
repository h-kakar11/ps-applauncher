'use strict';
/* ======================= Playtime statistics ======================= */

const statsView = { data: null, loadedAt: 0, loading: false, days: 30, top: '30', cursor: null };

const WEEKDAY_SHORT = (i) => new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' });
const monthShort = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' }); };
const hourLabel = (h) => new Date(2024, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });

function deltaHtml(cur, prev, label) {
  if (!prev) return cur ? `<span class="delta is-up">New this period</span>` : `<span class="delta">${label}</span>`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return `<span class="delta">Same as ${label}</span>`;
  return `<span class="delta ${pct > 0 ? 'is-up' : 'is-down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${label}</span>`;
}

/* ----- Chart builders (shared by the Stats screen and the per-game dialog) ----- */
function barsChart(values, { tip, peak = true, cursor = null, cls = '' } = {}) {
  const max = Math.max(...values, 1);
  const top = peak ? values.indexOf(Math.max(...values)) : -1;
  return `<div class="chart ${cls}" style="--n:${values.length}">${values.map((ms, i) =>
    `<div class="cbar${ms ? '' : ' is-zero'}${i === top && ms ? ' is-peak' : ''}${i === cursor ? ' is-cursor' : ''}" data-i="${i}" style="height:${ms ? Math.max(5, (ms / max) * 100) : 0}%" title="${esc(tip ? tip(i, ms) : fmtDuration(ms))}"></div>`).join('')}</div>`;
}

function axisLabels(labels, cls = '') {
  return `<div class="chart-axis ${cls}" style="--n:${labels.length}">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
}

function hourChart(hours) {
  const total = sum(hours);
  const peakHour = hours.indexOf(Math.max(...hours));
  const buckets = [['Morning', 6, 12], ['Afternoon', 12, 18], ['Evening', 18, 24], ['Night', 0, 6]].map(([name, a, b]) => ({ name, ms: sum(hours.slice(a, b)) }));
  const best = [...buckets].sort((x, y) => y.ms - x.ms)[0];
  return `
    ${barsChart(hours, { tip: (i, ms) => `${hourLabel(i)}: ${fmtDuration(ms)}`, cls: 'chart--hours' })}
    ${axisLabels(hours.map((_, i) => (i % 6 === 0 ? hourLabel(i) : '')), 'chart-axis--hours')}
    <p class="chart-note">${total ? `You play most around <b>${hourLabel(peakHour)}</b>. ${best.name}s are your favourite time (${Math.round((best.ms / total) * 100)}%).` : 'Play a game to see when you play.'}</p>`;
}

function weekdayChart(weekdays) {
  const order = state.settings.weekStartsOn === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const values = order.map((d) => weekdays[d]);
  const best = order[values.indexOf(Math.max(...values))];
  return `
    ${barsChart(values, { tip: (i, ms) => `${WEEKDAY_SHORT(order[i])}: ${fmtDuration(ms)}`, cls: 'chart--week' })}
    ${axisLabels(order.map((d) => WEEKDAY_SHORT(d)), 'chart-axis--week')}
    <p class="chart-note">${sum(values) ? `<b>${new Date(2024, 0, 7 + best).toLocaleDateString(undefined, { weekday: 'long' })}s</b> are your busiest day.` : 'No playtime recorded yet.'}</p>`;
}

function monthChart(months) {
  const best = months.reduce((a, m) => (m.ms > a.ms ? m : a), months[0]);
  return `
    ${barsChart(months.map((m) => m.ms), { tip: (i, ms) => `${monthShort(months[i].month)} ${months[i].month.slice(0, 4)}: ${fmtDuration(ms)}`, cls: 'chart--months' })}
    ${axisLabels(months.map((m) => monthShort(m.month)), 'chart-axis--months')}
    <p class="chart-note">${best.ms ? `Your biggest month was <b>${monthShort(best.month)} ${best.month.slice(0, 4)}</b> with ${fmtDuration(best.ms)}.` : 'No playtime recorded yet.'}</p>`;
}

function heatmapHtml(daily, heatStart) {
  const wsd = state.settings.weekStartsOn === 'sun' ? 0 : 1;
  const offset = (new Date(heatStart).getDay() - wsd + 7) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<i class="hm hm--blank"></i>');
  const level = (ms) => (ms <= 0 ? 0 : ms < 1800000 ? 1 : ms < 5400000 ? 2 : ms < 10800000 ? 3 : 4);
  const labels = [];
  let lastMonth = -1;
  daily.forEach((ms, i) => {
    const d = new Date(heatStart);
    d.setDate(d.getDate() + i);
    const col = Math.floor((i + offset) / 7);
    if (d.getMonth() !== lastMonth && (i + offset) % 7 < 4 && (labels[labels.length - 1]?.col ?? -9) < col - 2) {
      labels.push({ col, text: d.toLocaleDateString(undefined, { month: 'short' }) });
      lastMonth = d.getMonth();
    } else if (d.getMonth() !== lastMonth && labels.length === 0) lastMonth = d.getMonth();
    cells.push(`<i class="hm hm--${level(ms)}" title="${esc(fmtDate(d.getTime()))}: ${ms ? fmtDuration(ms) : 'no play'}"></i>`);
  });
  const cols = Math.ceil((daily.length + offset) / 7);
  return `
    <div class="heatmap" style="--cols:${cols}">
      <div class="hm-months">${labels.map((l) => `<span style="grid-column:${l.col + 1}">${l.text}</span>`).join('')}</div>
      <div class="hm-grid">${cells.join('')}</div>
    </div>
    <div class="hm-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="hm hm--${l}"></i>`).join('')}<span>More</span></div>`;
}

function sessionRows(list, withGame) {
  if (!list.length) return '<p class="muted">No sessions recorded yet. Time is counted while a game launched from here is running.</p>';
  return `<ul class="session-list">${list.map((s) => {
    const g = withGame ? byId(s.gameId) : null;
    return `<li>${g ? (g.cover ? `<img class="sess-thumb" src="${esc(g.cover)}" alt="">` : '<span class="sess-thumb"></span>') : ''}
      <span class="sess-main"><b>${esc(withGame ? (s.name || g?.name || 'Game') : fmtDay(s.start))}</b><small>${fmtRelative(s.start)} · ${fmtTime(s.start)}</small></span>
      <span class="sess-len">${fmtHM(s.end - s.start)}</span></li>`;
  }).join('')}</ul>`;
}

/* ----- Stats screen ----- */
function tile(icon, value, label, sub) {
  return `<article tabindex="0" class="stat-tile" data-nav>${icon}<div><b>${value}</b><span>${label}</span><small>${sub || ''}</small></div></article>`;
}

function statsHtml(d) {
  const p = d.periods;
  const goalMs = d.goalHours * 3600000;
  const week = p.thisWeek;
  const days = statsView.days;
  const dailyShown = d.daily.slice(-days);
  const cursor = statsView.cursor ?? dailyShown.length - 1;
  const dayLabel = (i) => fmtDay(Date.now() - (dailyShown.length - 1 - i) * DAY_MS);
  const topList = { 7: d.top7, 30: d.top30, 365: d.top365, all: d.topAll }[statsView.top] || d.top30;
  const topMax = topList[0]?.ms || 1;
  const gaugeValue = goalMs ? `${Math.min(100, Math.round((week / goalMs) * 100))}%` : '';

  if (!d.allTimeMs && !d.sessions) {
    return `<div class="stats-empty"><h2>No playtime yet</h2><p class="muted">Launch a game from here and its time shows up in this screen. Already played games before? Add that time in a game’s Edit details.</p></div>`;
  }

  return `
    <div class="stats-head">
      <h1 class="library-title">Playtime</h1>
      <p class="library-summary">${fmtDuration(d.allTimeMs)} across ${d.gamesPlayed} of ${d.gamesTotal} ${d.gamesTotal === 1 ? 'game' : 'games'}${d.importedMs ? ` · includes ${fmtDuration(d.importedMs)} from before the library` : ''}</p>
    </div>
    <div class="stat-tiles">
      ${tile(ICON.clock, fmtDuration(d.allTimeMs), 'Total played', `${d.sessions.toLocaleString()} ${d.sessions === 1 ? 'session' : 'sessions'}`)}
      ${tile(ICON.calendar, fmtDuration(week), 'This week', deltaHtml(week, p.lastWeek, 'last week'))}
      ${tile(ICON.chart, fmtDuration(p.last30), 'Last 30 days', deltaHtml(p.last30, p.prev30, 'the 30 before'))}
      ${tile(ICON.stopwatch, d.sessions ? fmtHM(d.avgSessionMs) : '—', 'Average session', d.longest ? `Longest ${fmtHM(d.longest.ms)}${d.longest.name ? ` · ${esc(d.longest.name)}` : ''}` : '')}
      ${tile(ICON.flame, `${d.streak.current} ${d.streak.current === 1 ? 'day' : 'days'}`, 'Current streak', `Best ${d.streak.longest} ${d.streak.longest === 1 ? 'day' : 'days'}`)}
      ${tile(ICON.play, `${d.activeDays}`, 'Days played', d.busiestDay ? `Busiest ${fmtDate(new Date(d.busiestDay.date + 'T12:00').getTime())} · ${fmtDuration(d.busiestDay.ms)}` : '')}
    </div>

    <div class="stats-grid">
      <article tabindex="0" class="stat-card span-4" data-nav>
        <h3 class="w-title">${ICON.trophy}Weekly goal<span class="w-aside">${state.settings.weekStartsOn === 'sun' ? 'Sun' : 'Mon'}–${state.settings.weekStartsOn === 'sun' ? 'Sat' : 'Sun'}</span></h3>
        ${goalMs
          ? `<div class="goal">${gaugeHtml([{ value: Math.min(week, goalMs), color: '#53b1ff' }], goalMs, gaugeValue, 'of goal')}
              <div class="goal-text"><b>${fmtHM(week)}</b> of ${d.goalHours} hrs<small>${week >= goalMs ? 'Goal reached. Nice one.' : `${fmtHM(goalMs - week)} to go`}</small></div></div>`
          : `<p class="muted">Set a weekly playtime goal and watch it fill. Choose one in Settings, under Playtime.</p>
             <button class="btn btn-ghost btn-sm" data-nav data-stats-goal>Set a goal</button>`}
      </article>

      <article tabindex="0" class="stat-card span-8" data-nav data-scrub>
        <h3 class="w-title">${ICON.chart}Daily activity
          <span class="chips chips-inline">${[14, 30, 90].map((n) => `<button class="chip chip-sm${days === n ? ' is-active' : ''}" data-nav data-days="${n}">${n} days</button>`).join('')}</span></h3>
        <div class="chart-readout" id="chart-readout">${dayLabel(cursor)}<b>${fmtDuration(dailyShown[cursor] || 0)}</b></div>
        ${barsChart(dailyShown, { tip: (i, ms) => `${dayLabel(i)}: ${fmtDuration(ms)}`, peak: false, cursor: statsView.cursor, cls: 'chart--days' })}
        ${axisLabels(dailyShown.map((_, i) => (i === 0 || i === dailyShown.length - 1 || i === Math.floor(dailyShown.length / 2) ? fmtDate(Date.now() - (dailyShown.length - 1 - i) * DAY_MS).replace(/,? \d{4}$/, '') : '')), 'chart-axis--days')}
      </article>

      <article tabindex="0" class="stat-card span-12" data-nav>
        <h3 class="w-title">${ICON.calendar}The last year<span class="w-aside">${fmtDuration(p.last365)} in 12 months</span></h3>
        ${heatmapHtml(d.daily, d.heatStart)}
      </article>

      <article tabindex="0" class="stat-card span-4" data-nav>
        <h3 class="w-title">${ICON.clock}Time of day</h3>
        ${hourChart(d.hours)}
      </article>
      <article tabindex="0" class="stat-card span-4" data-nav>
        <h3 class="w-title">${ICON.calendar}Day of the week</h3>
        ${weekdayChart(d.weekdays)}
      </article>
      <article tabindex="0" class="stat-card span-4" data-nav>
        <h3 class="w-title">${ICON.chart}Month by month</h3>
        ${monthChart(d.months)}
      </article>

      <article class="stat-card span-7">
        <h3 class="w-title">${ICON.trophy}Top games
          <span class="chips chips-inline">${[['7', '7 days'], ['30', '30 days'], ['365', 'Year'], ['all', 'All time']].map(([k, l]) => `<button class="chip chip-sm${statsView.top === k ? ' is-active' : ''}" data-nav data-top="${k}">${l}</button>`).join('')}</span></h3>
        ${topList.length ? `<ul class="top-list">${topList.map((r, i) => {
          const g = byId(r.id);
          return `<li><button class="top-row" data-nav data-go-game="${r.id}">
            <span class="top-rank">${i + 1}</span>
            ${g?.cover ? `<img class="top-thumb" src="${esc(g.cover)}" alt="">` : '<span class="top-thumb"></span>'}
            <span class="top-main"><span class="top-name">${esc(r.name)}</span><span class="alloc-track"><span class="alloc-fill" style="width:${(r.ms / topMax) * 100}%"></span></span></span>
            <span class="top-time">${fmtDuration(r.ms)}<small>${Math.round(r.share * 100)}%</small></span></button></li>`;
        }).join('')}</ul>` : '<p class="muted">Nothing played in this period.</p>'}
      </article>

      <article class="stat-card span-5">
        <h3 class="w-title">${ICON.stopwatch}Recent sessions</h3>
        ${sessionRows(d.recent.slice(0, 9), true)}
      </article>
    </div>`;
}

async function loadStats(force = false) {
  if (statsView.loading || (!force && Date.now() - statsView.loadedAt < 4000)) return;
  statsView.loading = true;
  try {
    statsView.data = await api('/api/stats');
    statsView.loadedAt = Date.now();
    paintStats();
  } catch (e) {
    $('#view-stats').innerHTML = `<div class="stats-empty"><h2>Couldn’t load statistics</h2><p class="muted">${esc(e.message)}</p></div>`;
  } finally {
    statsView.loading = false;
  }
}

function paintStats() {
  const root = $('#view-stats');
  if (!statsView.data) return;
  const focusKey = root.contains(document.activeElement) ? focusPath(root, document.activeElement) : null;
  const scroll = root.scrollTop;
  root.innerHTML = statsHtml(statsView.data);
  root.scrollTop = scroll;
  if (focusKey !== null) restoreFocus(root, focusKey);
}

// A focus position that survives re-rendering: the index of the element among the focusable ones.
function focusPath(root, el) {
  const list = $$('[data-nav]', root);
  const i = list.indexOf(el);
  return i < 0 ? null : i;
}
function restoreFocus(root, i) {
  $$('[data-nav]', root)[i]?.focus({ preventScroll: true });
}

function renderStatsView() {
  if (!statsView.data) $('#view-stats').innerHTML = '<div class="stats-empty"><p class="muted">Loading statistics…</p></div>';
  else paintStats();
  loadStats(true);
}

/* ----- Scrubbing the daily chart with left and right ----- */
function scrubDays(step) {
  const shown = (statsView.data?.daily || []).slice(-statsView.days);
  if (!shown.length) return;
  const cur = statsView.cursor ?? shown.length - 1;
  const next = Math.min(shown.length - 1, Math.max(0, cur + step));
  if (next === cur && statsView.cursor !== null) return false;
  statsView.cursor = next;
  paintStats();
  return true;
}

navHooks.push((dir, cur, layer, { go, repeat }) => {
  if (layer || state.view !== 'stats' || !cur?.matches?.('[data-scrub]')) return false;
  if (dir !== 'left' && dir !== 'right') return false;
  const moved = scrubDays(dir === 'right' ? 1 : -1);
  if (moved) sfx.move();
  else if (!repeat) sfx.bump();
  return true;
});

$('#view-stats').addEventListener('click', (e) => {
  const days = e.target.closest('[data-days]');
  const top = e.target.closest('[data-top]');
  const go = e.target.closest('[data-go-game]');
  if (days) { statsView.days = Number(days.dataset.days); statsView.cursor = null; paintStats(); const chip = $(`#view-stats [data-days="${statsView.days}"]`); chip?.focus({ preventScroll: true }); }
  else if (top) { statsView.top = top.dataset.top; paintStats(); $(`#view-stats [data-top="${statsView.top}"]`)?.focus({ preventScroll: true }); }
  else if (go) goToGame(go.dataset.goGame);
  else if (e.target.closest('[data-stats-goal]')) { setView('settings', { focus: false }); openSettingsCategory('playtime'); }
});
$('#view-stats').addEventListener('mouseover', (e) => {
  const bar = e.target.closest('.chart--days .cbar');
  if (!bar || state.view !== 'stats') return;
  const shown = (statsView.data?.daily || []).slice(-statsView.days);
  const i = Number(bar.dataset.i);
  const r = $('#chart-readout');
  if (r) r.innerHTML = `${fmtDay(Date.now() - (shown.length - 1 - i) * DAY_MS)}<b>${fmtDuration(shown[i] || 0)}</b>`;
});

refreshHooks.push(() => { if (state.view === 'stats') loadStats(); });

/* ----- Per-game statistics ----- */
async function openGameStats(id) {
  const g = byId(id);
  if (!g) return;
  const layer = openLayer(`
    <div class="modal modal-wide game-stats" role="dialog" aria-label="${esc(g.name)} playtime">
      <h2>${esc(g.name)}</h2>
      <p class="muted" data-gs-sub>Loading…</p>
      <div data-gs-body></div>
      <div class="modal-actions"><button class="btn btn-primary" data-nav data-done autofocus>Done</button></div>
    </div>`);
  layer.addEventListener('click', (e) => { if (e.target.closest('[data-done]')) closeLayer(layer); });
  try {
    const d = await api(`/api/games/${id}/stats`);
    if (!layer.isConnected) return;
    const p = d.periods;
    layer.querySelector('[data-gs-sub]').textContent = d.allTimeMs
      ? `${fmtDuration(d.allTimeMs)} played${d.shareOfLibrary ? ` · ${Math.round(d.shareOfLibrary * 100)}% of your library time` : ''}`
      : 'No playtime recorded yet';
    const mini = (label, value, sub = '') => `<div class="mini-stat"><small>${label}</small><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    layer.querySelector('[data-gs-body]').innerHTML = `
      <div class="mini-stats">
        ${mini('Total played', fmtDuration(d.allTimeMs), d.importedMs ? `${fmtDuration(d.importedMs)} before the library` : '')}
        ${mini('Sessions', d.sessions.toLocaleString(), `${d.launches} ${d.launches === 1 ? 'launch' : 'launches'}`)}
        ${mini('Average session', d.sessions ? fmtHM(d.avgSessionMs) : '—')}
        ${mini('Longest session', d.longest ? fmtHM(d.longest.ms) : '—', d.longest ? fmtDate(d.longest.start) : '')}
        ${mini('Last 7 days', fmtDuration(p.last7), deltaHtml(p.last7, p.prev7, 'the 7 before'))}
        ${mini('Last 30 days', fmtDuration(p.last30))}
        ${mini('First played', d.firstPlayed ? fmtDate(d.firstPlayed) : '—', d.lastPlayed ? `Last ${fmtRelative(d.lastPlayed)}` : '')}
        ${mini('Streak', `${d.streak.current} ${d.streak.current === 1 ? 'day' : 'days'}`, `Best ${d.streak.longest}`)}
      </div>
      <div class="gs-cols">
        <div>
          <h3 class="list-heading">Last 30 days</h3>
          ${barsChart(d.daily.slice(-30), { peak: false, tip: (i, ms) => `${fmtDay(Date.now() - (29 - i) * DAY_MS)}: ${fmtDuration(ms)}`, cls: 'chart--days' })}
          <h3 class="list-heading">Time of day</h3>
          ${hourChart(d.hours)}
        </div>
        <div>
          <h3 class="list-heading">Recent sessions</h3>
          <div class="gs-sessions">${sessionRows(d.recent.slice(0, 20).map((s) => ({ ...s, gameId: id })), false)}</div>
        </div>
      </div>`;
  } catch (e) {
    layer.querySelector('[data-gs-sub]').textContent = e.message;
  }
}
