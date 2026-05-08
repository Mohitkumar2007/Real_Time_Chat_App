@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo === ByteTalk setup ===

if not exist "backend\.env" (
  echo Creating backend\.env from backend\.env.example
  copy "backend\.env.example" "backend\.env" >nul
  echo.
  set /p MONGO_URI_INPUT=Enter MongoDB URI [mongodb://localhost:27017/]: 
  if "!MONGO_URI_INPUT!"=="" set "MONGO_URI_INPUT=mongodb://localhost:27017/"
  powershell -NoProfile -Command "$mongoUri = [Environment]::GetEnvironmentVariable('MONGO_URI_INPUT'); (Get-Content 'backend\.env') -replace '^MONGO_URI=.*', ('MONGO_URI=' + $mongoUri) | Set-Content 'backend\.env'"
  echo Saved MongoDB URI to backend\.env
  echo.
)

if not exist "backend\Pro_venv\Scripts\python.exe" (
  echo Creating Python virtual environment at backend\Pro_venv
  python -m venv "backend\Pro_venv"
  if errorlevel 1 (
    echo Failed to create virtual environment. Make sure Python is installed and available as python.
    exit /b 1
  )
)

echo Installing backend dependencies...
"backend\Pro_venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b 1

"backend\Pro_venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 exit /b 1

echo Installing frontend dependencies...
cd "frontend"
call npm install
if errorlevel 1 exit /b 1

cd /d "%~dp0"
echo.
echo Setup complete.
echo Make sure MongoDB is running before starting the app.
echo Run run.bat to start backend and frontend.

endlocal
