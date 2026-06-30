'use client'

import React, { useState, useRef } from 'react'

type LyricsOcrHelperProps = {
  currentLyrics: string
  onApply: (lyrics: string) => void
  textareaId?: string
}

// クライアントサイド画像圧縮関数
async function resizeAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas 2D context を取得できませんでした。'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          // JPEG品質0.7で圧縮してBase64で出力
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'))
    reader.readAsDataURL(file)
  })
}

export default function LyricsOcrHelper({
  currentLyrics,
  onApply,
  textareaId
}: LyricsOcrHelperProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [ocrResult, setOcrResult] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 画像選択時の処理
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setOcrResult('')
    const file = e.target.files?.[0]
    if (!file) return

    // MIMEタイプ検証
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('対応していないファイル形式です。JPG, PNG, WebP形式の画像を選択してください。')
      setSelectedImage(null)
      setSelectedFile(null)
      return
    }

    try {
      // プレビュー用にローカルURLを生成
      const preview = URL.createObjectURL(file)
      setSelectedImage(preview)
      setSelectedFile(file)
    } catch (err) {
      console.error(err)
      setError('画像のプレビュー表示に失敗しました。')
    }
  }

  // OCR処理の実行
  const handleRunOcr = async () => {
    if (!selectedFile) return
    setLoading(true)
    setError('')
    setOcrResult('')

    try {
      // 1. クライアント側で画像をリサイズ&圧縮
      const compressedBase64 = await resizeAndCompressImage(selectedFile)

      // 圧縮後のBase64サイズチェック (約1.5MB上限)
      if (compressedBase64.length > 1_500_000) {
        throw new Error('圧縮後の画像ファイルサイズが大きすぎます。別の画像をお試しください。')
      }

      // 2. APIへの送信
      const res = await fetch('/api/admin/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressedBase64 })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '読み取り処理中にエラーが発生しました。')
      }

      setOcrResult(data.text || '')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'ネットワーク接続エラーが発生しました。'
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  // 入力欄へ上書き反映
  const handleApplyOverwrite = () => {
    if (!ocrResult.trim()) return
    
    if (currentLyrics.trim()) {
      const ok = confirm('現在の歌詞入力欄をOCR結果で上書きします。よろしいですか？')
      if (!ok) return
    }

    onApply(ocrResult.trim())
    handleScrollToTextarea()
  }

  // 入力欄末尾に追記反映
  const handleApplyAppend = () => {
    if (!ocrResult.trim()) return
    
    if (!currentLyrics.trim()) {
      onApply(ocrResult.trim())
    } else {
      const merged = `${currentLyrics.trim()}\n\n${ocrResult.trim()}`
      onApply(merged)
    }
    
    handleScrollToTextarea()
  }

  // 入力欄へスクロール & フォーカス
  const handleScrollToTextarea = () => {
    if (textareaId) {
      const el = document.getElementById(textareaId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
      }
    }
  }

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left space-y-4">
      <div>
        <p className="text-blue-400 font-semibold text-xs uppercase tracking-wider mb-1">画像から韓国語歌詞を読み取る</p>
        <p className="text-gray-500 text-[10px] leading-relaxed">
          著作権・利用許可を確認した歌詞画像のみ使用してください。読み取り結果は自動保存されません。内容を確認してから使用してください。
        </p>
      </div>

      {/* ファイル選択・プレビュー */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="bg-gray-800 hover:bg-gray-750 text-gray-200 hover:text-white px-4 py-2.5 rounded-lg border border-gray-700/80 text-xs font-semibold cursor-pointer transition-all active:scale-98"
          >
            画像を選択 / 写真を撮る
          </button>
          <span className="text-[10px] text-gray-500">対応: JPG / PNG / WebP</span>
        </div>

        {/* 選択画像プレビュー */}
        {selectedImage && (
          <div className="relative w-full max-h-48 bg-gray-950 rounded-lg overflow-hidden border border-gray-850 flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="選択されたプレビュー"
              className="max-h-40 max-w-full object-contain rounded"
            />
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-xs px-3 py-2.5 rounded-lg leading-relaxed">
          {error}
        </div>
      )}

      {/* OCR実行ボタン */}
      {selectedFile && !ocrResult && (
        <button
          onClick={handleRunOcr}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI歌詞読み取り中…
            </>
          ) : (
            'AIで韓国語歌詞を読み取る'
          )}
        </button>
      )}

      {/* OCR結果表示・編集エリア */}
      {ocrResult && (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider block">
              読み取り結果 (手動で修正できます):
            </span>
            <textarea
              value={ocrResult}
              onChange={(e) => setOcrResult(e.target.value)}
              rows={8}
              className="w-full bg-gray-950 text-white rounded-lg border border-gray-800 px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono leading-relaxed"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApplyOverwrite}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs transition-colors cursor-pointer text-center"
            >
              歌詞入力欄に上書き
            </button>
            <button
              onClick={handleApplyAppend}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white font-semibold py-2.5 rounded-lg text-xs transition-colors cursor-pointer text-center"
            >
              末尾に追記
            </button>
          </div>
        </div>
      )}

      {/* 入力欄へ移動ボタン */}
      {textareaId && !ocrResult && (
        <button
          onClick={handleScrollToTextarea}
          className="w-full bg-gray-800/40 hover:bg-gray-800 text-gray-400 hover:text-gray-200 font-medium py-2 rounded-xl text-[10px] uppercase tracking-wider border border-gray-800/60 transition-all cursor-pointer text-center"
        >
          ↓ 歌詞入力欄へ移動
        </button>
      )}
    </div>
  )
}
