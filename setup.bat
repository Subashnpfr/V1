@echo off
rem V1 Auto Captions Studio setup script for Windows

rem ---- Install Python dependencies globally (no virtual environment) ----
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt

rem ---- Install Node dependencies ----
pushd frontend
npm install
popd

rem ---- Optional: install concurrently to run both services together ----
npm install -g concurrently

rem ---- Start backend and frontend concurrently ----
start "" cmd /k "uvicorn backend.app:app --host 0.0.0.0 --port 8000"
start "" cmd /k "npm run dev --prefix frontend"
