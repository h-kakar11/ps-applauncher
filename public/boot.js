'use strict';
/* ======================= Start-up ======================= */
buildScene();
hidInit();
onPadsChanged(); // remember which controllers are already there so only new ones are announced

refresh().then(() => {
  const hash = location.hash;
  if (hash === '#explore' || (!hash && state.settings.startOn === 'explore')) select(EXPLORE_ID);
  else if (hash.startsWith('#item=')) { const it = state.items[Number(hash.slice(6))]; if (it) select(it.id); }
  if (hash === '#library') setView('library');
  else if (hash === '#stats') setView('stats');
  else if (hash.startsWith('#settings')) { openSettingsCategory(hash.split('=')[1] || 'profile', { focus: false }); setView('settings'); }
  else focusSelectedTile();
  if (hash.startsWith('#edit=')) { const it = state.items[Number(hash.slice(6))]; if (it?.g) openGameEditor(it.g); }
  if (state.busy.artwork) watchArtwork();
  if (connectedPads().length) startPadLoop();
});
