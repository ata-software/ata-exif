@echo off
echo Starting EXIF Editor at http://localhost:8085/ ...
start http://localhost:8085/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8085
