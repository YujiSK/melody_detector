# Audio to MIDI Converter (Windows Edition)

Windows環境で無料で使える、高機能な「音声→MIDI変換」ツールセットです。
Demucsによるピアノ/ボーカル分離機能も統合されています。

## Directory Structure

- **`audio/`**: 変換したい音声ファイル（MP3/WAV）を置く場所
- **`midi/`**: 生成されたMIDIファイルが保存される場所
- **`docs/`**: 説明書・ドキュメント
    - [README_WINDOWS.md](docs/README_WINDOWS.md): 基本的なインストールと使い方
    - [README_DEMUCS.md](docs/README_DEMUCS.md): Demucsを使った伴奏分離・高度な使い方
- **`scripts/`**: ユーティリティスクリプト
    - `install_demucs.bat`: Demucsのインストール
    - `cleanup.bat`: ファイル整理用

## Quick Start
（詳細は `docs/` 内のマニュアルを参照してください）

1. **セットアップ**: `scripts/setup_windows.bat` を実行
2. **変換実行**:
   ```bash
   python run_convert.py --input audio/my_song.mp3
   ```
   -> `midi/YYYYMMDD_HHMMSS_my_song.mid` が生成されます。

## Features
- **Auto-Timestamp**: 出力ファイル名に自動で日時が付与されます（上書き防止）
- **Auto-Filter**: `--highpass` / `--lowpass` でノイズ除去が可能
- **Separation**: Demucsを使ってピアノパートだけを抽出可能
