@echo off
rem Starts Edge Preview at http://localhost:8090 (uses Python if installed, otherwise the built-in PowerShell server)
cd /d "%~dp0"
start "" http://localhost:8090/
where python >nul 2>nul && (python -m http.server 8090) || (powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8090)
