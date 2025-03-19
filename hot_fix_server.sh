#!/bin/bash

PORT=7979

# Find the process using the port
PID=$(lsof -ti:$PORT)

if [ ! -z "$PID" ]; then
  echo "Port $PORT is in use by process $PID. Killing process..."
  kill -9 $PID
  echo "Process $PID killed."
else
  echo "Port $PORT is not in use."
fi

# Restart the application with nodemon
echo "Run ./start_service.sh to reset."
nodemon app.js
