@echo off
setlocal

cd /d "%~dp0"

if not exist "backend\Pro_venv\Scripts\python.exe" (
  echo backend\Pro_venv was not found. Run setup.bat first.
  exit /b 1
)

if not exist "backend\.env" (
  echo backend\.env was not found. Creating it from backend\.env.example
  copy "backend\.env.example" "backend\.env" >nul
)

echo Starting ByteTalk backend and frontend...
echo Backend:  http://127.0.0.1:8000/api/health/
echo Frontend: http://127.0.0.1:3000/
echo.

start "ByteTalk Backend" cmd /k "cd /d ""%~dp0backend"" && Pro_venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"
start "ByteTalk Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Both startup commands were launched in separate windows.
echo Keep both windows open while using the app.

endlocal
