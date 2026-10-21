# Game Library

Ultra-customisable, check our forks to see what you can do with this!
<a href = "https://github.com/kylehussain/PSLn"><img width="1909" height="1015" alt="fork of ps-applauncher" src="https://github.com/user-attachments/assets/3c129c74-9934-483e-bcce-43a883a99ea1" /></a>


A PS5-style, full-screen launcher for the games on your Windows PC. It pulls your library together from Steam, Epic, GOG, Ubisoft, EA, Xbox and plain game folders, then lets you browse and launch them with a controller or keyboard.

It is a small local web app: a zero-dependency Node.js server on `127.0.0.1` with a single-page UI in `public/`. Nothing is sent anywhere except the optional artwork, Spotify and Discord features described below.

> **Licence:** this is proprietary, view-only software. See [LICENSE](LICENSE). Viewing the code does not grant any right to use, copy or modify it.

## Features

- **Library scanning** from Steam, Epic, GOG, Ubisoft, EA and Xbox installs, plus any folders you add. Tools, crash handlers and junk executables are skipped. Rescans can run at startup or on a timer.
- **Artwork** (covers, backgrounds and logos) fetched automatically, or uploaded or pasted from a link.
- **Stats:** playtime, sessions, streaks and "most played" tracking.
- **Trophies** that unlock by rarity, with a platinum when everything is unlocked. Steam achievements can be imported.
- **Per-game details:** favourite, status, rating, notes and custom launch methods.
- **Wallpapers:** upload images or GIFs (video backgrounds are supported too).
- **Controllers:** battery levels for XInput pads (Xbox and compatible) and DualSense / DualShock 4 pads.
- **Spotify now-playing** with playback controls, connected through OAuth (PKCE, no client secret).
- **Discord Rich Presence** showing what you are playing.
- **Backup and restore:** export and import your library, notes and trophies.
- **Start with Windows** and a one-click shortcut for the Start menu, Desktop and taskbar.

## Requirements

- Windows 10 or 11 (most features are Windows-only: Steam/Epic/GOG detection, XInput, the startup shortcut and the app window).
- [Node.js](https://nodejs.org/en/download) **18.15 or newer**. No `npm install` is needed: the project has no runtime dependencies.

## Getting started

### Option 1: double-click (no console window)

Run **`Game Library.vbs`**. If Node.js is missing, it offers to open the download page.

Run **`Create Shortcut.vbs`** once to add a "Game Library" shortcut to the Start menu and Desktop. You can then pin it to the taskbar.

### Option 2: from a terminal

```bat
npm start
```

This runs `node server.js --open`, which starts the server and opens the library in an app-style window. Use **`start.bat`** if you want a visible console for troubleshooting. Without `--open`, run `node server.js` and visit <http://127.0.0.1:4545/> yourself.

### First run

1. Open **Settings** and add the folders that contain your games. Steam is detected automatically; use the Steam path setting if it is installed somewhere unusual.
2. Let the scan finish. Games appear in the carousel and the Library tab.
3. Optional: turn on automatic artwork, or set the Spotify and Discord options below.

## Optional integrations

### Spotify

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add this redirect URI exactly: `http://127.0.0.1:4545/spotify/callback`
3. Paste the app's Client ID (32 letters and numbers) into Settings, then click Connect.

### Discord

Turn on Rich Presence in Settings and enter your Discord application ID. Discord must be running on the same machine.

## Configuration

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `PS5LIB_PORT` | Port the server listens on | `4545` |
| `PS5LIB_DATA` | Folder for library data, images and wallpapers | `./data` |
| `PS5LIB_STEAM_PATH` | Steam install folder, if it is not in the default place | auto-detected |
| `PS5LIB_XBOX_DIR` | Extra folder to scan for Xbox / Game Pass titles | none |
| `PS5LIB_EPIC_MANIFESTS` | Epic manifests folder, if it is not in the default place | auto-detected |
| `PS5LIB_DISCORD_IPC` | Explicit path to Discord's IPC socket | auto-detected |

Everything the app stores lives in the data folder: `library.json` (settings, games, notes and trophies), `images/` and `wallpapers/`. Copy that folder to move your library to another machine, or use the built-in export.

The server only accepts requests whose `Host` header is `127.0.0.1` or `localhost`, so other machines and web pages cannot use it.

## Project layout

```
server.js            HTTP API, library database, scanning, launching, sessions
lib/                 Platform-specific helpers
  launchers.js       Steam / Epic / GOG / Ubisoft / EA / Xbox / shortcut detection
  exe.js             Picks the real game executable out of a folder
  stats.js           Playtime, sessions and streaks
  achievements.js    Trophy tiers and unlock logic
  discord.js         Discord Rich Presence over IPC
  controllers.js     XInput battery reading
  vdf.js             Steam VDF file parser
  platform.js        Windows integration (startup, process helpers)
public/              The web UI (served as-is)
  index.html         Single page; loads the scripts and styles below
  app.js             Main UI: carousel, library, search, launching
  launcher.js, stats-ui.js, trophies-ui.js, wallpaper.js,
  controllers-ui.js, settings.js, boot.js, controller-decode.js
  styles.css, features.css
test/                Node's built-in test runner (`npm test`)
design-system.md     Design notes for the UI
Game Library.vbs     Double-click launcher (no console window)
Create Shortcut.vbs  Creates Start menu / Desktop shortcuts
start.bat            Launcher with a visible console
```

## Development

```bash
npm test     # runs node --test (lib and server tests)
npm start    # starts the server and opens the app window
```

The tests start the real server against a temporary data folder, so they do not touch your library. No build step, bundler or linter is involved: edit the files and reload.

## Licence

Proprietary and view-only. Copyright (c) 2026 H K. All rights reserved. See [LICENSE](LICENSE).
