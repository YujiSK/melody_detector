
import sys
import os
import argparse
import subprocess
import shutil
from pathlib import Path

# Add the current directory to sys.path to ensure modules can be imported
sys.path.append(os.getcwd())

try:
    from sound_to_midi.monophonic import wave_to_midi
except ImportError as e:
    print(f"[ERROR] Failed to import core modules: {e}")
    print("Please run 'setup_windows.bat' to install dependencies.")
    sys.exit(1)

def check_ffmpeg():
    """Check if ffmpeg is available on PATH."""
    return shutil.which("ffmpeg") is not None

def main():
    parser = argparse.ArgumentParser(description="Audio to MIDI Converter Wrapper")
    parser.add_argument("--input", required=True, help="Input audio file path (WAV/MP3)")
    parser.add_argument("--output", required=True, help="Output MIDI file path (.mid)")
    parser.add_argument("--mono", action="store_true", help="Convert to mono before processing (Requires ffmpeg)")
    parser.add_argument("--start", type=float, help="Start time in seconds (Requires ffmpeg)")
    parser.add_argument("--end", type=float, help="End time in seconds (Requires ffmpeg)")
    
    args = parser.parse_args()
    
    has_ffmpeg = check_ffmpeg()
    input_path = Path(args.input)
    temp_wav_path = None
    
    # --- Guardrails for missing ffmpeg ---
    if not has_ffmpeg:
        # 1. Ban MP3 input
        if input_path.suffix.lower() == ".mp3":
            print("[ERROR] FFmpeg is missing. Cannot process MP3 files.")
            print("Please install FFmpeg or use a WAV file.")
            print("Refer to README_WINDOWS.md for installation instructions.")
            sys.exit(1)
            
        # 2. Ban advanced processing
        if args.mono or args.start is not None or args.end is not None:
             print("[ERROR] FFmpeg is missing. Cannot use --mono, --start, or --end.")
             print("Please install FFmpeg to use these features.")
             sys.exit(1)
    
    # --- File Processing ---
    final_input_for_conversion = str(input_path)
    
    # If we need ffmpeg processing (MP3, or slicing/mono requested)
    needs_conversion = (
        input_path.suffix.lower() == ".mp3" 
        or args.mono 
        or args.start is not None 
        or args.end is not None
    )
    
    if needs_conversion:
        if not has_ffmpeg:
             # Should be caught by guardrails above, but double check
             print("[ERROR] Unexpected state: FFmpeg required but not found.")
             sys.exit(1)
             
        print("[INFO] Pre-processing audio with ffmpeg...")
        temp_wav_path = Path("temp_conversion.wav")
        
        cmd = ["ffmpeg", "-y", "-i", str(input_path)]
        
        if args.start is not None:
            cmd.extend(["-ss", str(args.start)])
        
        if args.end is not None:
            cmd.extend(["-to", str(args.end)])
            
        if args.mono:
            cmd.extend(["-ac", "1"])
            
        # Output as WAV
        cmd.append(str(temp_wav_path))
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            final_input_for_conversion = str(temp_wav_path)
        except subprocess.CalledProcessError as e:
            print("[ERROR] FFmpeg processing failed.")
            print(e.stderr.decode() if e.stderr else "Unknown error")
            sys.exit(1)

    # --- Core Conversion ---
    print(f"[INFO] Converting '{final_input_for_conversion}' to MIDI...")
    try:
        # Load audio using librosa (handles WAV)
        import librosa
        audio_data, srate = librosa.load(final_input_for_conversion, sr=None)
        
        # Convert
        midi_obj = wave_to_midi(audio_data, srate=srate)
        
        # Save
        with open(args.output, 'wb') as f:
            midi_obj.writeFile(f)
            
        print(f"[SUCCESS] MIDI saved to: {os.path.abspath(args.output)}")
        
    except Exception as e:
        print(f"[ERROR] Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        # Cleanup
        if temp_wav_path and temp_wav_path.exists():
            try:
                os.remove(temp_wav_path)
                print("[INFO] Temp file cleaned up.")
            except:
                pass

if __name__ == "__main__":
    main()
