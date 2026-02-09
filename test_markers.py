import pretty_midi

pm = pretty_midi.PrettyMIDI()
inst = pretty_midi.Instrument(program=0)
note = pretty_midi.Note(velocity=100, pitch=60, start=0, end=1)
inst.notes.append(note)
pm.instruments.append(inst)

# Try adding lyrics (often interpreted as markers or text)
pm.lyrics.append(pretty_midi.Lyric('C Major', 0.0))
pm.lyrics.append(pretty_midi.Lyric('Am7', 2.0))

# Try adding key signature if possible (pretty_midi > 0.2.9 supports key_signature_changes)
try:
    pm.key_signature_changes.append(pretty_midi.KeySignature(0, 0.0)) # C Major
    print("Added key signature")
except:
    print("Key signature not supported in this version")

pm.write('test_marker.mid')
print("Written test_marker.mid")
