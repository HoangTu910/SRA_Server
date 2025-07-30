@echo off
set GITBASH="C:\Program Files\Git\bin\bash.exe"
start "Backend" cmd /k "color f0 && cd backend && npm start"
start "Broker" cmd /k "color f0 && cd broker && npm start"