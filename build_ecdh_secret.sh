#!/bin/bash

# Define the source directory
SRC_DIR="/home/iot-bts2/HHT_AIT/backend/src/app/diffie-hellman"

# Define the source files and the output executables
EXEC_SECRET="$SRC_DIR/exec-ecdh-secret"
EXEC_PUBLIC="$SRC_DIR/exec-ecdh-public"
ECdh_CPP="$SRC_DIR/ecdh.cpp"
EXEC_ECDH_SECRET_CPP="$SRC_DIR/exec-ecdh-secret.cpp"
EXEC_ECDH_PUBLIC_CPP="$SRC_DIR/exec-ecdh-public.cpp"

# Compile the C++ files using g++
g++ -o "$EXEC_SECRET" "$ECdh_CPP" "$EXEC_ECDH_SECRET_CPP"
g++ -o "$EXEC_PUBLIC" "$ECdh_CPP" "$EXEC_ECDH_PUBLIC_CPP"

# Check if both compilations succeeded
if [ $? -eq 0 ]; then
    echo "✅ Compilation successful."
    echo "Secret executable created at: $EXEC_SECRET"
    echo "Public executable created at: $EXEC_PUBLIC"
else
    echo "❌ Compilation failed."
    exit 1
fi
