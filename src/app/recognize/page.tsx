'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { cache } from '@/lib/indexeddb'
import WaveAnimation from '@/components/WaveAnimation'
import BottomNav from '@/components/layout/BottomNav'

type RecognizeResult =
  | { recognized: false; message: string }
  | { recognized: true; registered: false; acrcloud_music_id: string; title: string; artist?: string | null }
  | { recognized: true; registered: true; song_id: string; title: string; title_ja?: string | null; status: string }

type UIState = 'idle' | 'recording' | 'processing' | 'fail_not_found' | 'fail_unregistered'

export default function RecognizePage() {
  const router = useRouter()
  const { error: recError, start, reset } = useAudioRecorder()
  const [uiState, setUiState] = useState<UIState>('idle')
  const [unregisteredInfo, setUnregisteredInfo] = useState<{ title: string; artist?: string | null } | null>(null)
  const isStarted = useRef(false)

  const startRecognizing = useCallback(async () => {
    setUiState('recording')
    setUnregisteredInfo(null)
    try {
      const blob = await start(7000)
      setUiState('processing')
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')

      const res = await fetch('/api/recognize', { method: 'POST', body: formData })
      const data: RecognizeResult = await res.json()

      if (!data.recognized) {
        setUiState('fail_not_found')
        reset()
        return
      }

      if (!data.registered) {
        setUnregisteredInfo({ title: data.title, artist: data.artist })
        setUiState('fail_unregistered')
        reset()
        return
      }

      await cache.addRecent(data.song_id)
      router.push(`/songs/${data.song_id}`)
    } catch {
      setUiState('fail_not_found')
      reset()
    }
  }, [start, reset, router])

  // ページマウント時に一度だけ自動開始
  useEffect(() => {
    if (!isStarted.current) {
      isStarted.current = true
      startRecognizing()
    }
    return () => {
      reset()
    }
  }, [startRecognizing, reset])

  const handleRetry = () => {
    reset()
    startRecognizing()
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-900">
        <h1 className="font-semibold text-lg">音声認識</h1>
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 text-sm hover:text-white"
        >
          閉じる
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center pb-24 px-6 text-center">
        {uiState === 'recording' && (
          <div className="space-y-6">
            <WaveAnimation />
            <p className="text-blue-400 font-medium animate-pulse text-lg">賛美を聞き取り中…</p>
            <p className="text-gray-500 text-sm">スマートフォンのマイクを音源に近づけてください</p>
          </div>
        )}

        {uiState === 'processing' && (
          <div className="space-y-6">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-300 font-medium text-lg">曲を検索中…</p>
          </div>
        )}

        {uiState === 'fail_not_found' && (
          <div className="flex flex-col items-center gap-6 max-w-xs">
            <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center border border-gray-800">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">曲を認識できませんでした</p>
              <p className="text-gray-400 text-sm mt-1">もう少し近づけて、もう一度試してください</p>
            </div>
            {recError && <p className="text-red-400 text-xs">{recError}</p>}
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                もう一度聞き取る
              </button>
              <button
                onClick={() => router.push('/songs')}
                className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors text-sm"
              >
                曲名で検索する
              </button>
            </div>
          </div>
        )}

        {uiState === 'fail_unregistered' && (
          <div className="flex flex-col items-center gap-6 max-w-xs">
            <div className="w-20 h-20 rounded-full bg-yellow-900/20 flex items-center justify-center border border-yellow-800/50">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">未登録の曲です</p>
              {unregisteredInfo && (
                <p className="text-yellow-500/80 font-medium text-sm mt-1">
                  {unregisteredInfo.title}
                  {unregisteredInfo.artist && ` / ${unregisteredInfo.artist}`}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-2">管理者に登録を依頼してください</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                もう一度聞き取る
              </button>
              <button
                onClick={() => router.push('/songs')}
                className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors text-sm"
              >
                曲名で検索する
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
