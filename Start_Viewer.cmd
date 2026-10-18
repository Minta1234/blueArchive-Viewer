@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js or add it to PATH.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4317 in a browser after the server starts.
echo Keep this window open. Press Ctrl+C to stop the viewer.
node server.mjs
pause
