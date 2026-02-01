@echo off
setlocal

echo ========================================================
echo   Demucs Installation Script (Stable)
echo ========================================================

:: Check if .venv exists
if not exist ".venv" (
    echo [ERROR] Virtual environment (.venv) not found.
    echo Please run 'setup_windows.bat' first.
    exit /b 1
)

:: Activate Virtual Environment
call .venv\Scripts\activate

:: Install Demucs with PINNED PyTorch versions/Numpy to avoid Windows errors
echo [INFO] Installing Demucs with stable PyTorch 2.2.0 and Numpy<2.0...
pip install "torch==2.2.0" "torchaudio==2.2.0" "numpy<2.0" demucs

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Demucs.
    exit /b 1
)

echo.
echo ========================================================
echo   Demucs Installed Successfully!
echo ========================================================
echo Usage:
echo   demucs "path/to/your/audio.mp3"
echo.
echo Output will be in: separated/htdemucs/
echo.
