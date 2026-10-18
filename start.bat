@echo off
rem Opens the game library with a visible console (useful for troubleshooting).
cd /d "%~dp0"
node server.js --open
