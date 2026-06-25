'use client'

import { useRouter } from 'next/navigation'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { cache } from '@/lib/indexeddb'

type RecognizeResult =
  | { recognized: false; message: string }
  | { recognized: true; registered: false; acr_id: string; title: string; artist?: string }
  | { recognized: true; registered: true; song_id: string; title: string; title_ja?: string; status: string }

export default function ListenButton() {
  const router = useRouter()
  const { state, error, start, reset } = useAudioRecorder()

  async function handlePress() {
    if (state !== 'idle') return
    try {
      const blob = await start(7000)

      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')

      const res = await fetch('/api/recognize', { method: 'POST', body: formData })
      const data: RecognizeResult = await res.json()

      if (!data.recognized) {
        reset()
        alert('曲を認識できませんでした。もう一度試してください。')
        return
      }

      if (!data.registered) {
        reset()
        alert(`「${data.title}」は未登録の曲です。管理者に登録を依頼してください。`)
        return
      }

      await cache.addRecent(data.song_id)
      router.push(`/song/${data.song_id}`)
    } catch {
      reset()
    }
  }

  const isRecording = state === 'recording'
  const isProcessing = state === 'processing'
  const isActive = isRecording || isProcessing

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={handlePress}
        disabled={isActive}
        className={`
          relative w-40 h-40 rounded-full
          flex items-center justify-center
          text-white font-bold text-lg
          transition-all duration-300
          ${isActive
            ? 'bg-blue-500 scale-110 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 active:scale-95 cursor-pointer'
          }
        `}
        aria-label="聞き取る"
      >
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
            <span className="absolute inset-0 rounded-full bg-blue-300 animate-ping opacity-20 delay-300" />
          </>
        )}
        <span className="relative z-10 flex flex-col items-center gap-1">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span className="text-sm">聞き取る</span>
        </span>
      </button>

      <p className="text-gray-400 text-sm h-5">
        {isRecording && '聞き取り中…'}
        {isProcessing && '曲を探しています…'}
        {error && <span className="text-red-400">{error}</span>}
      </p>
    </div>
  )
}
