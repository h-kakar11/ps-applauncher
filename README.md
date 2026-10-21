# PS5-style Game Library

any issues? goto https://github.com/h-kakar11/ps-applauncher/issues


A full-screen, controller-friendly launcher for your local PC games, styled after the PS5 home screen (see `design-system.md`).

## Run

Double-click **`Game Library.vbs`** (or `start.bat` if you want a console window for troubleshooting).

Requires Node.js 18.15+ and Edge, Chrome or Brave. Nothing to install: there are no npm dependencies.

On first launch it looks for installed games in Steam, Epic, GOG, Ubisoft Connect, the EA app and Xbox, plus any games
folders you add. Manage them in **Settings → Games & Library**.

## Pin to the taskbar (one-click launch)

Double-click **`Create Shortcut.vbs`** once. It adds a **Game Library** shortcut to the Start menu and Desktop; press
Win, type *Game Library*, right-click it and choose **Pin to taskbar**. Or make the shortcut by hand:

Windows won't pin a `.vbs` file directly, so make a shortcut that runs it through `wscript.exe`:

1. Right-click the desktop → **New → Shortcut**.
2. For the location, enter (change the path to where you cloned this repo):
   ```
   wscript.exe "C:\path\to\ps-applauncher\Game Library.vbs"
   ```
3. Name it **Game Library** and click **Finish**.
4. *(Optional)* Right-click the shortcut → **Properties → Change Icon…** to pick an icon.
5. Right-click the shortcut → **Show more options** (Windows 11) → **Pin to taskbar**. On Windows 10 it's directly in the menu. You can also drag the shortcut onto the taskbar.

From now on, one click on the taskbar icon starts the server and opens the library, with no console window.

Prefer a Start menu entry? Pin the same shortcut to **Start** instead.

## Home screen

- **Carousel:** the selected tile stays parked near the left and the row slides around it. Pressing past either end wraps around (holding the stick stops at the ends). Order it by recently played, favorites, most played or name in Settings.
- **Explore** (first tile): an animated PlayStation-symbol backdrop (or your own wallpaper, see below) with widgets: play summary and level, controllers with battery, storage, continue playing, most played, recently added, 14-day activity, sessions, trophies, library and size allocation. The row scrolls sideways.
- **Games:** full-screen key art, the game's logo, a line with time played, size, status, rating and trophy progress, your pinned note, and **Play** (or **Resume** while it runs) with quick buttons for favorite, trophies, notes, playtime and options.
- **Game library** (last tile) opens the full grid with search, sorting and filters (favorites, status, not played, needs attention). **Surprise me** picks a game for you.
- **Stats** tab: see [Playtime statistics](#playtime-statistics).
- **Top bar:** a now-playing chip while a game runs, the [controller indicator](#controllers-and-battery), search, settings, your avatar and the clock.

## Finding your games

Games are found automatically and kept up to date:

- **Steam:** every library on every drive is read from Steam's own files, so names, install sizes and artwork are exact and games launch through Steam. Tools such as Proton and the Steamworks redistributables are skipped.
- **Epic Games, GOG, Ubisoft Connect, EA app, Xbox / Microsoft Store** (`XboxGames` folders).
- **Games folders:** any number of folders. Every folder inside is treated as a game; the best executable is chosen by name match and location instead of file size, and installers, crash handlers and launchers are ignored.
- **Shortcuts:** `.url` (Steam or launcher links) and `.lnk` files placed in a games folder.

New installs are picked up when the library starts, or every 30 minutes or 2 hours if you prefer (**Settings → Games & Library → Look for new games**, or **Scan for games** in the Library tab). A game you remove is remembered and isn't added back by later scans; **Restore removed games** undoes that.

## Launching

- **Play** starts the game the way it expects: through Steam or the store launcher for those games, otherwise the executable with your launch options, a custom start-in folder and optional **Run as administrator**. Games can also launch from any launcher link (`com.epicgames.launcher://…`) or a Steam App ID.
- A **launch screen** shows until the game is up. If it never appears you get a clear message instead of silence.
- While a game runs, **Play** becomes **Resume** and brings its window to the front. **Close game** (game options) shuts it down after a confirmation.
- When a game ends you see how long you played.
- **Settings → Launcher:** start the library with Windows, choose how long it stays alive after its window closes, and more.

## Playtime statistics

The **Stats** tab shows total time, this week and the last 30 days against the period before, average and longest sessions, current and best streak, a weekly goal ring, a daily activity chart (14, 30 or 90 days; scrub it with left/right), a year-long calendar heat map, when you play (hour of day and day of week), month-by-month totals, top games by 7 days / 30 days / year / all time, and recent sessions. Each game has its own **Playtime** page with the same detail.

Played a game before using the library? Enter that time under **Edit details → Playtime before using the library**.

## Trophies, notes, favorites

- **Trophies** (button on a game, or game options): a per-game checklist with Bronze, Silver and Gold grades. **Import from Steam** pulls a game's official achievement list (names, descriptions, icons, global rarity, which also sets the grade). You can also add your own goals. Tick trophies off for the PS5-style pop-up and chime; finishing a list of three or more earns the Platinum. The Explore page totals your points and trophy level.
- **Notes:** any number of notes per game; pin one to show it on the game's page.
- **Favorites, status and rating:** mark favorites, set Playing / Backlog / Completed / Dropped / On hold, and give 1–5 stars. Filter and sort the library by them.

## Discover wallpaper

Highlight **Explore** and press □ (or use **Settings → Appearance & Sounds → Discover wallpaper**) to choose a wallpaper: pictures, animated **GIFs** and short **videos** (WebM or MP4). Highlighting one in the chooser previews it live. Add files from the PC, a link, or by drag and drop; use one wallpaper or shuffle through them every 1–60 minutes. Optionally keep the floating symbols over it. Wallpapers are stored in `data/wallpapers/`.

## Controllers and battery

A controller icon in the top bar lights up when a controller works and shows its battery. Click it (or **Settings → Controller**) for a live button and stick tester and a vibration test.

- **Xbox / XInput pads:** battery in four steps, read by the local service.
- **DualSense and DualShock 4:** the browser reads the battery over WebHID. Click **Enable battery reporting** once and pick the controller in the browser prompt; it's remembered. If another program (Steam Input, DS4Windows) has exclusive control of the pad, the battery can't be read.
- A low-battery warning appears at the level you choose.

## Discord status

For games that don't show up on your Discord profile by themselves, the library can set the status: **Playing <game>** with elapsed time, trophy progress and the Steam cover when the game has a Steam App ID.

1. Open **Settings → Discord** and press **Open page** (discord.com/developers/applications), then **New Application**. The application's name is what Discord shows after "Playing", so name it what you like.
2. Copy its **Application ID** into the setting and turn on **Show my game on Discord**. Discord must be running on the same PC.

By default games Discord already detects on its own are skipped so they aren't shown twice. In a game's **Edit details** you can force the status **Always** or turn it **Never**. Optionally show "Browsing the library" when idle.

## Settings

A console-style screen (open it with the gear, **Options/Start** or `Esc` to leave): profile and avatar, games folders and launcher detection, scan schedule, launcher behavior, clock, interface size, animations, background dimming, home order, sounds and volume, wallpapers, confirm button (✕ or ○), stick sensitivity, vibration, low-battery level, weekly goal, ignored short sessions, trophy pop-ups, Discord, and backup and restore.

**Settings → Data & Backup** exports your playtime, trophies, notes, ratings and settings to a file, and restores them (merging, never deleting).

## Controls

| Controller | Keyboard | Action |
|---|---|---|
| ✕ / A | Enter | Select / launch game |
| ○ / B | Esc | Back |
| □ / X | O | Game options (wallpapers on Explore) |
| △ / Y | / | Search |
| L1 / R1 | Q / E | Previous / next tab (Games, Library, Stats) |
| Options / Start | | Settings |
| Right stick | | Scroll |
| | F11 | Toggle full screen |

A text box opens an on-screen keyboard (letters, symbols, Enter for notes) when you press ✕ on it with a controller.

## Artwork

New games get a cover, background and logo automatically from the game's public Steam store page (games found through Steam use their exact App ID). Only the game name is sent, to Steam's store search. Turn this off in **Settings → Games & Library**, or use **Find artwork for all games** there.

To pick artwork yourself, open a game's options → **Edit details and launch options**. For the cover (square), background (16:9) and logo (transparent PNG) you can:
- press **Find artwork online** and choose the right game
- click the image box to pick a file, or use **Browse PC** (controller friendly)
- paste an image **URL**
- copy an image anywhere, select the box and press **Ctrl+V**
- drag and drop a file onto the box

## How tracking works

The app polls the Windows process list and matches it against the game's executables, so time is counted even when a launcher stub starts the real game. The library keeps running in the background while a game is open and exits after its window has been closed for a while (default 5 minutes, adjustable) and no game is running.

Data lives in `data/` (`library.json`, `images/`, `wallpapers/`). Set `PS5LIB_DATA` to keep it somewhere else, and `PS5LIB_PORT` to change the port (default 4545).

## Development

No dependencies. `npm test` (or `node --test`) runs the unit and API tests; they start the real server against temporary folders.

## Privacy

Nothing leaves your PC except: game names sent to Steam's store search, requests for artwork and achievement lists from Steam's public pages, Discord's public list of detectable games (cached for a week), and your Discord status if you turn it on.

## License

Proprietary, view-only. See `LICENSE`.
