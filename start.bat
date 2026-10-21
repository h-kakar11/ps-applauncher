@echo off
rem Opens the game library with a visible console (useful for troubleshooting).
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Game Library needs Node.js, which was not found on PATH.
  echo Install it from https://nodejs.org/en/download and try again.
  pause
  exit /b 1
)
node server.js --open
