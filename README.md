# PS5-style Game Library

any issues? goto https://github.com/h-kakar11/ps-applauncher/issues


A full-screen, controller-friendly launcher for your local PC games, styled after the PS5 home screen (see `design-system.md`).

## Run

Double-click **`Game Library.vbs`** (or `start.bat` if you want a console window for troubleshooting).

Requires Node.js 18.15+ and Edge, Chrome or Brave. Nothing to install: there are no npm dependencies.

On first launch it scans `A:\games` and adds every game folder it finds. Change the folder in **Settings**.

## Pin to the taskbar (one-click launch)

Double-click **`Create Shortcut.vbs`** once. It adds a **Game Library** shortcut to the Start menu and Desktop; press
Win, type *Game Library*, right-click it and choose **Pin to taskbar**. Or make the shortcut by hand:

Windows won't pin a `.vbs` file directly, so make a shortcut that runs it through `wscript.exe`:

1. Right-click the desktop → **New → Shortcut**.
2. For the location, enter (change the path to where you cloned this repo):
   ```
   wscript.exe "C:\path	o\ps-applauncher\Game Library.vbs"
   ```
3. Name it **Game Library** and click **Finish**.
4. *(Optional)* Right-click the shortcut → **Properties → Change Icon…** to pick an icon.
5. Right-click the shortcut → **Show more options** (Windows 11) → **Pin to taskbar**. On Windows 10 it's directly in the menu. You can also drag the shortcut onto the taskbar.

From now on, one click on the taskbar icon starts the server and opens the library, with no console window.

Prefer a Start menu entry? Pin the same shortcut to **Start** instead.

## Home screen

- **Carousel:** the selected tile stays parked near the left and the row slides around it. Pressing past either end wraps around (holding the stick stops at the ends).
- **Explore** (first tile): an animated PlayStation-symbol backdrop with every stat as widgets: play summary and level, controllers, storage, continue playing, most played, recently added, 14-day activity, sessions, library and size allocation. The row scrolls sideways.
- **Games:** full-screen key art, the game's logo, and a discreet line with time played and size, plus **Play** and options.
- **Game library** (last tile) opens the full grid with search and sorting.

## Controls

| Controller | Keyboard | Action |
|---|---|---|
| ✕ / A | Enter | Select / launch game |
| ○ / B | Esc | Back |
| □ / X | O | Game options (edit, artwork, open folder, reset stats, remove) |
| △ / Y | / | Search |
| L1 / R1 | Q / E | Switch Games ↔ Library |
| Options / Start | | Settings |
| | F11 | Toggle full screen |

## Music (Spotify)

The **Music** tile (second in the row) shows what's playing on Spotify: album art, a progress bar, and previous / play-pause / next buttons underneath. The art also becomes the backdrop. It controls whichever Spotify device is active, normally the Spotify app on this PC, so start Spotify there and the library mirrors and controls it.

One-time setup (about two minutes):

1. Go to <https://developer.spotify.com/dashboard> and create an app. Tick **Web API**.
2. Add this exact **Redirect URI**: `http://127.0.0.1:4545/spotify/callback` (use `127.0.0.1`, not `localhost`; change the port if you set `PS5LIB_PORT`).
3. Copy the app's **Client ID**, open **Settings → Spotify** in the library, paste it, and press **Connect Spotify**. Approve access in the browser tab that opens.

Notes:
- Playback controls (play, pause, skip, seek) need **Spotify Premium**. Showing what's playing does not.
- No client secret is used (PKCE sign-in). Tokens are stored locally in `data/library.json`; **Disconnect Spotify** in Settings deletes them.
- If no Spotify device is active, pressing play wakes the last one you used. Spotify must be open on a device for this to work.
- Click the progress bar to seek. With a keyboard or controller, focus the bar and press ← / → to skip 10 seconds.

## Artwork

New games get a cover, background and logo automatically from the game's public Steam store page. Only the game name is sent, to Steam's store search. Turn this off in **Settings → Artwork**, or use **Find artwork for all games** there.

To pick artwork yourself, open a game's options → **Edit details and artwork**. For the cover (square), background (16:9) and logo (transparent PNG) you can:
- press **Find artwork online** and choose the right game
- click the image box to pick a file, or use **Browse PC** (controller friendly)
- paste an image **URL**
- copy an image anywhere, select the box and press **Ctrl+V**
- drag and drop a file onto the box

## How tracking works

The app polls the Windows process list and matches it against the game's executables, so time is counted even when a launcher stub starts the real game. The library keeps running in the background while a game is open and exits 5 minutes after its window is closed and no game is running.

Data lives in `data/library.json`; artwork lives in `data/images/`.
