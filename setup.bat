@echo off
rem V1 Auto Captions Studio - Windows setup script

rem ---- Ensure script runs from repository root ----
cd /d "%~dp0"

rem ---- Install Python dependencies globally (no virtual environment) ----
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt

rem ---- Clean previous Node artifacts ----
if exist frontend\package-lock.json del /f frontend\package-lock.json
if exist frontend\node_modules rmdir /s /q frontend\node_modules

rem ---- Install Node dependencies and enforce patched Next version ----
pushd frontend
npm install
npm install next@15.5.23 --save-exact
npm audit fix --force
npm approve-scripts --allow-scripts-pending
npm install sharp@latest --save-exact
popd

rem ---- Install concurrently for combined run (global) ----
npm install -g concurrently

rem ---- Start backend and frontend concurrently ----
start "Backend" cmd /k "cd backend && python -m uvicorn app:app --host 0.0.0.0 --port 8000"
start "Frontend" cmd /k "npm run dev --prefix frontend"
