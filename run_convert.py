
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
    parser.add_argument("--output", help="Output MIDI file path (.mid). If omitted, saves to midi/ folder with timestamp.")
    parser.add_argument("--mono", action="store_true", help="Convert to mono before processing (Requires ffmpeg)")
    parser.add_argument("--start", type=float, help="Start time in seconds (Requires ffmpeg)")
    parser.add_argument("--end", type=float, help="End time in seconds (Requires ffmpeg)")
    parser.add_argument("--highpass", type=int, help="Highpass filter frequency in Hz (Requires ffmpeg)")
    parser.add_argument("--lowpass", type=int, help="Lowpass filter frequency in Hz (Requires ffmpeg)")
    parser.add_argument("--time_stretch", type=float, default=1.0, help="Speed factor (0.5=half speed, 2.0=double speed). Requires ffmpeg.")
    parser.add_argument("--model", choices=["monophonic", "basic_pitch"], default="monophonic", help="Transcription model. 'monophonic' (default) or 'basic_pitch' (polyphonic/chords).")
    
    args = parser.parse_args()
    
    # --- Auto-generate Output Path ---
    if not args.output:
        import datetime
        input_filename = Path(args.input).stem
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"{timestamp}_{input_filename}.mid"
        
        # Ensure midi directory exists
        output_dir = Path("midi")
        output_dir.mkdir(exist_ok=True)
        
        args.output = str(output_dir / output_filename)
        print(f"[INFO] Output path auto-generated: {args.output}")

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
        if args.mono or args.start is not None or args.end is not None or args.highpass is not None or args.lowpass is not None or args.time_stretch != 1.0:
             print("[ERROR] FFmpeg is missing. Cannot use advanced features (--mono, --start, --end, --highpass, --lowpass, --time_stretch).")
             print("Please install FFmpeg to use these features.")
             sys.exit(1)
    
    # --- Validate time_stretch ---
    if args.time_stretch != 1.0:
        if not (0.5 <= args.time_stretch <= 2.0):
            print(f"[ERROR] --time_stretch must be between 0.5 and 2.0. (Got: {args.time_stretch})")
            sys.exit(1)

    # --- File Processing ---
    final_input_for_conversion = str(input_path)
    
    # If we need ffmpeg processing (MP3, or slicing/mono/filters/stretch requested)
    needs_conversion = (
        input_path.suffix.lower() == ".mp3" 
        or args.mono 
        or args.start is not None 
        or args.end is not None
        or args.highpass is not None
        or args.lowpass is not None
        or args.time_stretch != 1.0
    )
    
    if needs_conversion:
        if not has_ffmpeg:
             # Should be caught by guardrails above, but double check
             print("[ERROR] Unexpected state: FFmpeg required but not found.")
             sys.exit(1)
             
        print("[INFO] Pre-processing audio with ffmpeg...")
        # Add descriptive filters to logic
        filters = []
        if args.highpass:
            filters.append(f"highpass=f={args.highpass}")
        if args.lowpass:
            filters.append(f"lowpass=f={args.lowpass}")
        if args.time_stretch != 1.0:
            filters.append(f"atempo={args.time_stretch}")
            
        temp_wav_path = Path("temp_conversion.wav")
        
        cmd = ["ffmpeg", "-y", "-i", str(input_path)]
        
        if args.start is not None:
            cmd.extend(["-ss", str(args.start)])
        
        if args.end is not None:
            cmd.extend(["-to", str(args.end)])
            
        # Audio filters
        audio_filters = []
        if args.mono:
            # -ac 1 is strictly channel count, but often combined with filters
            cmd.extend(["-ac", "1"])
        
        if filters:
            cmd.extend(["-af", ",".join(filters)])
            
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
    print(f"[INFO] Converting '{final_input_for_conversion}' to MIDI (Model: {args.model})...")
    
    try:
        if args.model == "basic_pitch":
            # --- Polyphonic (BasicPitch) ---
            # TF 2.16+ (Keras 3) requires this for legacy model loading
            os.environ["TF_USE_LEGACY_KERAS"] = "1"
            
            try:
                from basic_pitch.inference import predict_and_save
                from basic_pitch import ICASSP_2022_MODEL_PATH
            except ImportError:
                print("[ERROR] 'basic-pitch' not found.")
                print("Please run 'setup_windows.bat' again to install polyphonic support.")
                sys.exit(1)
                
            # BasicPitch outputs to a directory with a generated filename.
            # We output to a temp dir, then move to args.output.
            # Note: BasicPitch saves as <filename>_basic_pitch.mid
            
            output_path_obj = Path(args.output)
            temp_output_dir = output_path_obj.parent
            
            # Predict
            predict_and_save(
                audio_path_list=[final_input_for_conversion],
                output_directory=str(temp_output_dir),
                save_midi=True,
                sonify_midi=False,
                save_model_outputs=False,
                save_notes=False,
                model_or_model_path=ICASSP_2022_MODEL_PATH,
                sonification_samplerate=44100,
                midi_tempo=120
            )
            
            # Find the generated file. BasicPitch appends '_basic_pitch.mid' to the stem.
            input_stem = Path(final_input_for_conversion).stem
            generated_file = temp_output_dir / f"{input_stem}_basic_pitch.mid"
            
            if generated_file.exists():
                # Rename/Move to target output
                if generated_file != output_path_obj:
                    # Remove target if exists (overwrite)
                    if output_path_obj.exists():
                        os.remove(output_path_obj)
                    os.rename(generated_file, output_path_obj)
                print(f"[SUCCESS] MIDI saved to: {os.path.abspath(args.output)}")
            else:
                print(f"[ERROR] BasicPitch completed but output file not found: {generated_file}")
                sys.exit(1)

        else:
            # --- Monophonic (Original) ---
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
