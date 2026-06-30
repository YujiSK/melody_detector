'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { cache } from '@/lib/indexeddb'

type RecognizeResult =
  | { recognized: false; message: string }
  | { recognized: true; registered: false; acrcloud_music_id: string; title: string; artist?: string | null }
  | { recognized: true; registered: true; song_id: string; title: string; title_ja?: string | null; is_active: boolean }

type UIState = 'idle' | 'recording' | 'processing' | 'fail_not_found' | 'fail_unregistered'

export default function ListenButton() {
  const router = useRouter()
  const { state: recState, error: recError, start, reset } = useAudioRecorder()
  const [uiState, setUiState] = useState<UIState>('idle')
  const [unregisteredInfo, setUnregisteredInfo] = useState<{ title: string; artist?: string | null } | null>(null)

  const isRecording = recState === 'recording'
  const isProcessing = recState === 'processing'
  const isActive = isRecording || isProcessing

  async function handlePress() {
    if (isActive || uiState === 'fail_not_found' || uiState === 'fail_unregistered') {
      // 再試行
      setUiState('idle')
      setUnregisteredInfo(null)
      reset()
      return
    }

    try {
      const blob = await start(7000)
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
      router.push(`/song/${data.song_id}`)
    } catch {
      setUiState('fail_not_found')
      reset()
    }
  }

  // 失敗UI
  if (uiState === 'fail_not_found') {
    return (
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-white font-medium">曲を認識できませんでした</p>
        <p className="text-gray-400 text-sm">もう少し近づけて、もう一度試してください</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handlePress}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            もう一度聞き取る
          </button>
          <button
            onClick={() => { router.push('/search'); reset(); setUiState('idle') }}
            className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors text-sm"
          >
            曲名で探す
          </button>
        </div>
      </div>
    )
  }

  if (uiState === 'fail_unregistered') {
    return (
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-900/30 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div>
          <p className="text-white font-medium">未登録の曲です</p>
          {unregisteredInfo && (
            <p className="text-gray-400 text-sm mt-1">
              {unregisteredInfo.title}
              {unregisteredInfo.artist && ` / ${unregisteredInfo.artist}`}
            </p>
          )}
          <p className="text-gray-500 text-xs mt-2">管理者に登録を依頼してください</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handlePress}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            もう一度聞き取る
          </button>
          <button
            onClick={() => { router.push('/search'); reset(); setUiState('idle') }}
            className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors text-sm"
          >
            曲名で探す
          </button>
        </div>
      </div>
    )
  }

  // 通常UI（録音ボタン）
  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={handlePress}
        disabled={isActive}
        className={`
          relative w-44 h-44 rounded-full
          flex items-center justify-center
          text-white font-bold
          transition-all duration-300
          ${isActive
            ? 'bg-blue-500 scale-110 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 active:scale-95 cursor-pointer shadow-lg shadow-blue-900/50'
          }
        `}
        aria-label="聞き取る"
      >
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
            <span className="absolute inset-[-8px] rounded-full bg-blue-500/20 animate-ping" style={{ animationDelay: '0.3s' }} />
          </>
        )}
        <span className="relative z-10 flex flex-col items-center gap-2">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span className="text-base font-semibold">聞き取る</span>
        </span>
      </button>

      <p className="text-gray-500 text-sm h-5 text-center">
        {isRecording && <span className="text-blue-400">聞き取り中…</span>}
        {isProcessing && <span className="text-gray-300">曲を探しています…</span>}
        {recError && <span className="text-red-400">{recError}</span>}
        {!isActive && !recError && 'ボタンを押して曲を聞き取ります'}
      </p>
    </div>
  )
}
