@echo off
chcp 65001 >nul
title ANTI ARCADE - LAN Server (Port 8080)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0lan_server.ps1"
pause
