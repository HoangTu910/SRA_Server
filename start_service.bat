@echo off
start "Backend" cmd /c "cd backend && npm start"
start "Broker" cmd /c "cd broker && npm start"