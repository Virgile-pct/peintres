@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Ouverture de l'appli dans le navigateur...
start "" http://localhost:8766/
python -m http.server 8766 --directory docs
