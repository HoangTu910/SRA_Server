#!/bin/bash

# Set paths
OUTPUT_PATH="/home/iot-bts2/HHT_AIT/backend/src/app/cryptography/exec-decrypt"
SRC_PATH="/home/iot-bts2/HHT_AIT/backend/src/app/cryptography/src"

# Compile with g++
g++ -o "$OUTPUT_PATH" \
    "$SRC_PATH/asconCore.cpp" \
    "$SRC_PATH/asconDecrypt.cpp" \
    "$SRC_PATH/asconPermutation.cpp" \
    "$SRC_PATH/asconPrintstate.cpp" \
    "$SRC_PATH/execAsconDecrypt.cpp"

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo "✅ Compilation successful: $OUTPUT_PATH"
else
    echo "❌ Compilation failed."
    exit 1
fi
