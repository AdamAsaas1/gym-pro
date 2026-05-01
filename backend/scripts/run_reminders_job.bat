@echo off
setlocal

set "PROJECT_DIR=C:\Users\hp\Desktop\gym-pro-backend"
set "PYTHON_EXE=C:\Users\hp\Desktop\gym-pro-backend\.venv\Scripts\python.exe"
set "LOG_FILE=%PROJECT_DIR%\logs\reminder_job.log"

cd /d "%PROJECT_DIR%"

echo ==== [%date% %time%] Start reminder job ==== >> "%LOG_FILE%"
"%PYTHON_EXE%" scripts\send_reminders_job.py >> "%LOG_FILE%" 2>&1
echo ==== [%date% %time%] End reminder job ==== >> "%LOG_FILE%"

endlocal
