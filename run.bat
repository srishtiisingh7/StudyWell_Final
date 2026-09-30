@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3 and run this file again.
  pause
  exit /b 1
)
echo Starting StudyWell at http://localhost:8000
start "StudyWell" http://localhost:8000
python -m http.server 8000
