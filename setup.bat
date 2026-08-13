@echo off
rem V1 Auto Captions Studio - Windows setup script
cd /d "%~dp0"

echo Checking FFmpeg...
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo FFmpeg not found. Installing via winget...
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo Failed to install FFmpeg. Install manually: https://www.gyan.dev/ffmpeg/builds/
        exit /b 1
    )
    echo.
    echo FFmpeg was installed. Close this window, open a NEW terminal, then run setup.bat again
    echo so PATH includes ffmpeg. Then start the app.
    pause
    exit /b 0
)
where ffprobe >nul 2>&1
if errorlevel 1 (
    echo ffprobe not found. Reinstall FFmpeg full build: winget install Gyan.FFmpeg
    exit /b 1
)
echo FFmpeg OK.

echo Installing Python dependencies...
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo Python dependency install failed.
    exit /b 1
)

echo Installing frontend dependencies...
pushd frontend
call npm install
if errorlevel 1 (
    popd
    echo Frontend dependency install failed.
    exit /b 1
)
popd

echo.
echo Setup complete. Starting backend and frontend...
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USERPATH=%%B"
set "PATH=%SYSPATH%;%USERPATH%"
start "V1 Backend" cmd /k "cd /d %~dp0 && set PATH=%SYSPATH%;%USERPATH% && python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload"
start "V1 Frontend" cmd /k "npm run dev --prefix frontend"

echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:3000
