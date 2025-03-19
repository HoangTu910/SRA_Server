@echo off
echo Checking for processes using ports 7000 and 7979...

:: Find and kill process on port 7000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":7000"') do (
    echo Killing process on port 7000 with PID %%a...
    taskkill /PID %%a /F
)

:: Find and kill process on port 7979
for /f "tokens=5" %%b in ('netstat -aon ^| find ":7979"') do (
    echo Killing process on port 7979 with PID %%b...
    taskkill /PID %%b /F
)

echo Ports 7000 and 7979 are now free.
pause
