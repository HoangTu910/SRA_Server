@echo off
setlocal

REM Define the source directory
set "SRC_DIR=C:\Users\Hii\Desktop\HHT_AIT\backend\src\app\diffie-hellman"

REM Define the source files and the output executables
set "EXEC_SECRET=%SRC_DIR%\exec-ecdh-secret.exe"
set "EXEC_PUBLIC=%SRC_DIR%\exec-ecdh-public.exe"
set "ECdh_CPP=%SRC_DIR%\ecdh.cpp"
set "EXEC_ECDH_SECRET_CPP=%SRC_DIR%\exec-ecdh-secret.cpp"
set "EXEC_ECDH_PUBLIC_CPP=%SRC_DIR%\exec-ecdh-public.cpp"

REM Compile the C++ files using g++
g++ -o "%EXEC_SECRET%" "%ECdh_CPP%" "%EXEC_ECDH_SECRET_CPP%"
if %ERRORLEVEL% EQU 0 (
    echo Compilation of exec-ecdh-secret successful.
) else (
    echo Compilation of exec-ecdh-secret failed.
    exit /b 1
)

g++ -o "%EXEC_PUBLIC%" "%ECdh_CPP%" "%EXEC_ECDH_PUBLIC_CPP%"
if %ERRORLEVEL% EQU 0 (
    echo Compilation of exec-ecdh-public successful.
    echo Secret executable created at: %EXEC_SECRET%
    echo Public executable created at: %EXEC_PUBLIC%
) else (
    echo Compilation of exec-ecdh-public failed.
    exit /b 1
)

echo ✅ Compilation successful.
endlocal