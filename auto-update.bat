@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================== >> "%~dp0maj.log"
echo Mise a jour automatique : %DATE% %TIME% >> "%~dp0maj.log"
python generate.py >> "%~dp0maj.log" 2>&1
if exist ".git" (
  git add -A >> "%~dp0maj.log" 2>&1
  git commit -m "Mise a jour auto des fiches" >> "%~dp0maj.log" 2>&1
  git push >> "%~dp0maj.log" 2>&1
)
echo Termine : %DATE% %TIME% >> "%~dp0maj.log"
