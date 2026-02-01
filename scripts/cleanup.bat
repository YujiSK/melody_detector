@echo off
setlocal
pushd "%~dp0.."

echo [INFO] Cleaning up project directory...

:: Create directories if they don't exist
if not exist "midi" mkdir midi
if not exist "docs" mkdir docs

:: Move MIDI files
if exist "*.mid" (
    echo [INFO] Moving .mid files to midi/
    move *.mid midi/
)

:: Move PDF files (documentation/results)
if exist "*.pdf" (
    echo [INFO] Moving .pdf files to docs/
    move *.pdf docs/
)

:: Move specific markdown documentation (excluding READMEs)
if exist "monophonic_audio_to_midi.md" (
    echo [INFO] Moving monophonic_audio_to_midi.md to docs/
    move monophonic_audio_to_midi.md docs/
)

echo [SUCCESS] Cleanup complete.
echo.
pause
