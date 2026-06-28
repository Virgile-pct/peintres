@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Mise a jour du moteur de recherche
echo ============================================
echo.
echo Lecture des fiches et reconstruction de l'index...
python generate.py
if errorlevel 1 (
  echo.
  echo ERREUR pendant la generation. Voir le message ci-dessus.
  pause
  exit /b 1
)

echo.
REM --- Publication en ligne (active une fois GitHub configure) ---
if exist ".git" (
  echo Publication en ligne...
  git add -A
  git commit -m "Mise a jour des fiches" 2>nul
  git push
  echo.
  echo Termine ! Le site en ligne sera a jour dans une minute.
) else (
  echo Index reconstruit en local.
  echo (La publication en ligne sera activee une fois GitHub configure.)
)
echo.
pause
