@echo off
setlocal

REM Set paths
set "OUTPUT_PATH=C:\Users\Hii\Desktop\HHT_AIT\backend\src\app\cryptography\exec-decrypt.exe"
set "SRC_PATH=C:\Users\Hii\Desktop\HHT_AIT\backend\src\app\cryptography\src"

REM Compile with g++
g++ -o "%OUTPUT_PATH%" ^
    "%SRC_PATH%\asconCore.cpp" ^
    "%SRC_PATH%\asconDecrypt.cpp" ^
    "%SRC_PATH%\asconPermutation.cpp" ^
    "%SRC_PATH%\asconPrintstate.cpp" ^
    "%SRC_PATH%\execAsconDecrypt.cpp"

REM Check if compilation was successful
if %ERRORLEVEL% EQU 0 (
    echo Compilation successful: %OUTPUT_PATH%
) else (
    echo Compilation failed.
    exit /b 1
)

endlocal