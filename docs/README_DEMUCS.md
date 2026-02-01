# 🎹 ピアノ・メロディ抽出ガイド (Demucs編)

Moises無料版などでは難しい「ピアノ単体の分離」や「高精度なメロディ抽出」を行うための手順です。
無料かつ高精度なAIツール **Demucs** を使用します。

## 1. 準備 (インストール)

1. まだ実施していない場合、`setup_windows.bat` を実行して基本セットアップを完了させてください。
2. **`install_demucs.bat`** をダブルクリックして実行してください。
   - Demucs がインストールされます。

## 2. 実践フロー：ピアノ/メロディのMIDI化

### Step 1: 音源を分離する

Git Bash (またはコマンドプロンプト) で以下を実行します。
※ 初回実行時はAIモデルのダウンロードが走るため少し時間がかかります。

```bash
# 仮想環境を有効化 (まだの場合)
source .venv/Scripts/activate  # Git Bash
# .venv\Scripts\activate     # Cmd

# Demucsで分離実行
demucs "audio/my_song.mp3"
```

成功すると、`separated/htdemucs/my_song/` フォルダの中に以下の4ファイルが生成されます：
- `vocals.wav` (ボーカル)
- `drums.wav` (ドラム)
- `bass.wav` (ベース)
- **`other.wav` (その他：ピアノ、ギター、シンセなど)**

### Step 2: 目的のパートをMIDI変換する

#### パターンA：伴奏（ピアノ含む）をメロディ化したい
`other.wav` を使います。

```bash
python run_convert.py --input separated/htdemucs/my_song/other.wav --output result_piano.mid
```

#### パターンB：ボーカルメロディをMIDI化したい
`vocals.wav` を使います。

```bash
python run_convert.py --input separated/htdemucs/my_song/vocals.wav --output result_vocal.mid
```

---

## 💡 ヒント：イントロだけ切り出して変換

分離後のファイルに対しても、`run_convert.py` の切り出し機能 (`--start`, `--end`) は有効です。

**例：伴奏(`other.wav`)の冒頭30秒(イントロ)だけをMIDIにする**

```bash
python run_convert.py --input separated/htdemucs/my_song/other.wav --output intro_piano.mid --start 0 --end 30
```


## 💡 ヒント2：さらにノイズを減らす (EQフィルタ・モノラル化)

`other.wav` にまだベース音が残っていたり、ステレオの位相ズレで音符が増える場合は、フィルタとモノラル化を組み合わせましょう。

**推奨設定（Pro Tips）**
- **--highpass 150〜300**: ベース・キックをカットしてコード感を残す（おすすめ: 200）
- **--lowpass 2500〜5000**: 高音ノイズをカットしてメロディを安定させる（おすすめ: 3500）
- **--mono**: 左右のズレをなくして音程推定を安定させる

**例：最強のピアノ抽出コマンド**
イントロ45秒、モノラル化、EQでクリーニングを全部入りで行います。

```bash
python run_convert.py --input separated/htdemucs/my_song/other.wav --output piano_pro.mid --start 0 --end 45 --mono --highpass 200 --lowpass 3500
```

> **注意点**: 
> - `lowpass` を下げすぎるとピアノのアタック感が消えて逆に精度が落ちることがあります。
> - `highpass` を上げすぎると左手の伴奏音符が消えることがあります。


## 3. (Pro) ピアノ単体を直接抜き出す (6-stemモデル)

Demucsには、ピアノとギターを個別に分離できる特殊なモデル `htdemucs_6s` があります。
`other.wav` ではなく **`piano.wav`** が直接手に入ります。

### 実行方法
`-n htdemucs_6s` オプションを付けて実行します。

```bash
demucs -n htdemucs_6s "audio/my_song.mp3"
```

### 結果
`separated/htdemucs_6s/my_song/` フォルダの中に、以下の6ファイルが生成されます：
- `vocals.wav`
- `drums.wav`
- `bass.wav`
- `other.wav`
- **`piano.wav`** (ピアノ単体！)
- **`guitar.wav`** (ギター単体！)

**ピアノ耳コピに最適**:
この `piano.wav` を `run_convert.py` にかければ、伴奏ノイズがほぼゼロの状態でMIDI化できます。

```bash
python run_convert.py --input separated/htdemucs_6s/my_song/piano.wav --output piano_solo.mid
```
