# Audio to MIDI Converter for Windows

Windows環境で無料で利用できる音声（WAV/MP3）からMIDIへの変換ツールセットです。
元のリポジトリ（[tiagoft/audio_to_midi](https://github.com/tiagoft/audio_to_midi)）をWindowsで簡単に扱えるようにするためのバッチファイルとラッパースクリプトが含まれています。

## 📥 インストール手順

### 1. Python のインストール
Python 3.8以上が必要です。まだの場合は公式サイトからインストールし、**「Add Python to PATH」** にチェックを入れてください。

### 2. セットアップの実行
同梱の `setup_windows.bat` をダブルクリック（またはコマンドプロンプトで実行）してください。

このスクリプトは以下の処理を行います：
- 仮想環境（.venv）の作成
- 必要なライブラリのインストール
- `librosa` 等のインポートテスト

画面に `Setup Complete!` と表示されたら準備完了です。

### 3. FFmpeg のインストール（推奨）
MP3の変換や、`--start`/`--end` による切り出し機能を使うには **FFmpeg** が必要です。

1. [FFmpeg公式サイト](https://ffmpeg.org/download.html) から Windows 用ビルドをダウンロード。
2. 解凍して `bin` フォルダへのパスを環境変数 `Path` に追加。
3. コマンドプロンプトで `ffmpeg -version` と打ち、表示されれば成功です。

> **※ FFmpeg なしでも WAV ファイルの丸ごと変換は可能です。**

---

## 🎹 使い方

コマンドプロンプトを開き、以下の形式で実行します。
（初回は必ず `.venv\Scripts\activate` を忘れずに、または `setup_windows.bat` 実行直後にそのまま続けてください）

基本コマンド:
```bat
python run_convert.py --input <入力ファイル> --output <出力ファイル.mid>
```

### 実行例

**1. 基本的なWAV変換**
```bat
python run_convert.py --input melody.wav --output melody.mid
```

**2. MP3を変換（FFmpeg必須）**
```bat
python run_convert.py --input song.mp3 --output song.mid
```

**3. 最初の10秒だけを切り出して変換（FFmpeg必須）**
```bat
python run_convert.py --input song.mp3 --output snippet.mid --start 0 --end 10
```

**4. モノラルに変換してから処理（FFmpeg必須）**
```bat
python run_convert.py --input stereo.wav --output mono_result.mid --mono
```

---

## 🛠️ トラブルシューティング

### Q. `ImportError` が出る、または `setup_windows.bat` が途中で止まる
A. `pip` の依存関係解決に失敗している可能性があります。以下を試してください。
1. `setup_windows.bat` をもう一度実行する。
2. それでもダメな場合、開発者モードでインストールしてみる：
   ```bat
   .venv\Scripts\activate
   pip install -e .
   ```

### Q. "FFmpeg is missing" と言われる
A. FFmpegがインストールされていないか、PATHが通っていません。WAVファイルを用意して `--start`/`--end`/`--mono` オプション無しで実行してください。

---

## 開発者向け
リポジトリを編集しながら使う場合は、`pip install -r requirements_windows.txt` の後に `pip install -e .` を実行すると、ソースコードの変更が即座に反映されます。
