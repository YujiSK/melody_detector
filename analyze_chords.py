import argparse
import pretty_midi
import numpy as np
from collections import Counter

def get_chroma_vector(notes):
    """
    Generates a chroma vector (12-dim) from a list of notes.
    """
    chroma = np.zeros(12)
    for note in notes:
        chroma[note.pitch % 12] += 1
    return chroma

def identify_chord(chroma):
    """
    Identifies the chord from a chroma vector.
    Simple pattern matching for Major, Minor, and basic 7ths.
    """
    # Pitch class names
    NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    # Chord intervals relative to root
    CHORD_TEMPLATES = {
        'Major': [0, 4, 7],
        'Minor': [0, 3, 7],
        'Dim':   [0, 3, 6],
        'Aug':   [0, 4, 8],
        'Maj7':  [0, 4, 7, 11],
        'min7':  [0, 3, 7, 10],
        '7':     [0, 4, 7, 10],
        'dim7':  [0, 3, 6, 9],
    }

    best_fit = None
    max_score = -1

    active_pitches = np.where(chroma > 0)[0]
    if len(active_pitches) < 3:
        return None # Not enough notes for a triad

    # Normalize chroma for scoring (simple presence/absence for now, or use weights)
    # Using weighted score based on note duration/velocity would be better, 
    # but let's stick to simple presence match for first iteration.
    
    # Iterate through all possible roots
    for root in range(12):
        for chord_type, intervals in CHORD_TEMPLATES.items():
            # Calculate expected pitch classes for this chord
            expected_pitches = set([(root + i) % 12 for i in intervals])
            
            # Count how many expected pitches are present
            score = 0
            match_count = 0
            
            current_pitches = set(np.where(chroma > 0.1)[0]) # Threshold to ignore noise
            
            for p in current_pitches:
                if p in expected_pitches:
                    match_count += 1
                    score += 1.0 # Basic score
                    
            # Penalize extra notes
            extra_notes = len(current_pitches) - match_count
            score -= extra_notes * 0.5

            # Boost if all chord tones are present
            if match_count == len(intervals):
                score += 2.0
            
            # Simple heuristic: must have at least 3 matching notes for basic chords
            if match_count >= 3:
                 if score > max_score:
                    max_score = score
                    best_fit = f"{NOTE_NAMES[root]} {chord_type}"

    return best_fit

def analyze_midi(midi_path, interval_sec=1.0, output_path=None):
    try:
        pm = pretty_midi.PrettyMIDI(midi_path)
    except Exception as e:
        print(f"[ERROR] Could not load MIDI file: {e}")
        return

    end_time = pm.get_end_time()
    current_time = 0.0
    
    # Flatten all notes from all instruments
    all_notes = []
    for instrument in pm.instruments:
        if not instrument.is_drum:
            all_notes.extend(instrument.notes)
    
    all_notes.sort(key=lambda x: x.start)
    
    print(f"Time (s) | Estimated Chord")
    print(f"---------|----------------")

    last_chord = None
    chord_events = []

    while current_time < end_time:
        segment_end = current_time + interval_sec
        
        # Find notes active in this segment
        segment_notes = [
            n for n in all_notes 
            if n.start < segment_end and n.end > current_time
        ]
        
        if segment_notes:
            chroma = get_chroma_vector(segment_notes)
            chord = identify_chord(chroma)
            
            if chord:
                if chord != last_chord:
                    print(f"{current_time:6.1f}   | {chord}")
                    last_chord = chord
                    # Add to list for MIDI export
                    chord_events.append((current_time, chord))
            else:
                if last_chord is not None:
                     print(f"{current_time:6.1f}   | (NC)")
                     last_chord = None
        
        current_time += interval_sec

    # Save to MIDI if output requested
    if output_path:
        print(f"\n[INFO] saving with chord markers to: {output_path}")
        # Clear existing lyrics/text
        pm.lyrics = []
        for time, chord_name in chord_events:
            # Create Lyric event
            lyric_event = pretty_midi.Lyric(chord_name, time)
            pm.lyrics.append(lyric_event)
        
        try:
            pm.write(output_path)
            print("[SUCCESS] MIDI file saved.")
        except Exception as e:
            print(f"[ERROR] Failed to write MIDI: {e}")

def main():
    parser = argparse.ArgumentParser(description="Estimate chords from MIDI file.")
    parser.add_argument("--input", required=True, help="Input MIDI file path")
    parser.add_argument("--interval", type=float, default=0.5, help="Analysis interval in seconds")
    parser.add_argument("--output", help="Output MIDI file path to save with chord markers")
    
    args = parser.parse_args()
    
    analyze_midi(args.input, args.interval, args.output)

if __name__ == "__main__":
    main()
