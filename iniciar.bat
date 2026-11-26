@echo off
rem Arranca el servidor de El taller de retratos y abre el juego y el panel.
cd /d "%~dp0"
start "" http://localhost:3220/panel
start "" http://localhost:3220/
python server.py
pause
