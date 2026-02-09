@echo off
setlocal
pushd "%~dp0.."

echo ========================================================
echo   Audio to MIDI - Windows Setup
echo ========================================================

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found on PATH. Please install Python 3.8+ and add to PATH.
    exit /b 1
)

:: Check ffmpeg (Optional but recommended)
where ffmpeg >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] 'ffmpeg' not found on PATH.
    echo           - MP3 conversion will NOT work.
    echo           - Time slicing ^(--start/--end^) will NOT work.
    echo           - Only WAV files can be processed.
    echo.
) else (
    echo [INFO] ffmpeg found. Full features enabled.
)

:: Create Virtual Environment
if not exist ".venv" (
    echo [INFO] Creating virtual environment ^(.venv^)...
    python -m venv .venv
) else (
    echo [INFO] Virtual environment ^(.venv^) already exists.
)

:: Activate Virtual Environment
call .venv\Scripts\activate

:: Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

:: Install Dependencies
echo [INFO] Installing requirements from requirements_windows.txt...
pip install -r requirements_windows.txt

:: Install Polyphonic Support (Spotify BasicPitch)
echo [INFO] Installing Polyphonic Transcription support (TensorFlow, BasicPitch)...
:: 1. TensorFlow & Keras Compatibility
pip install "tensorflow>=2.0" tf-keras --prefer-binary
:: 2. Audio Utilities (Install individually to avoid build failures)
pip install pretty_midi mir_eval
:: 3. Resampy (Often fails build on Windows, try no-build-isolation)
pip install resampy --no-build-isolation
:: 4. BasicPitch (No deps to avoid re-triggering numpy conflict)
pip install basic-pitch --no-deps

:: Import Verification
echo.
echo [INFO] Verifying installation...
python -c "import librosa; import midiutil; import soundfile; import numpy; import basic_pitch; print('SUCCESS: All core libraries imported correctly.')"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Import verification failed.
    echo [SUGGESTION] Try the following:
    echo    1. Run this script again.
    echo    2. Manually run: pip install --upgrade numpy librosa
    exit /b 1
)

echo.
echo ========================================================
echo   Setup Complete!
echo ========================================================
echo Usage: python run_convert.py --input audio.wav --output result.mid
echo.
