'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { cache } from '@/lib/indexeddb'
import WaveAnimation from '@/components/WaveAnimation'
import BottomNav from '@/components/layout/BottomNav'
import LyricSearchHelper from '@/components/LyricSearchHelper'

type RecognizeResult =
  | { recognized: false; message: string; acrcloud_raw?: unknown }
  | { recognized: true; registered: false; acrcloud_music_id: string; title: string; artist?: string | null; acrcloud_raw?: unknown }
  | { recognized: true; registered: true; song_id: string; title: string; title_ja?: string | null; status: string }

type UIState = 'idle' | 'recording' | 'processing' | 'fail_not_found' | 'fail_unregistered'

export default function RecognizePage() {
  const router = useRouter()
  const { error: recError, start, reset } = useAudioRecorder()
  const [uiState, setUiState] = useState<UIState>('idle')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [unregisteredInfo, setUnregisteredInfo] = useState<any>(null)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const isStarted = useRef(false)

  const startRecognizing = useCallback(async () => {
    setUiState('recording')
    setUnregisteredInfo(null)
    setRegisterError('')
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
        setUnregisteredInfo(data.acrcloud_raw)
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

  const handleRegisterSong = async () => {
    if (!unregisteredInfo) return
    setRegistering(true)
    setRegisterError('')

    const music = unregisteredInfo.metadata?.music?.[0]
    if (!music) {
      setRegisterError('曲情報が取得できませんでした')
      setRegistering(false)
      return
    }

    const title = music.title
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artist = (music.artists as any[])?.map((a) => a.name).join(' / ') || ''
    const acrid = music.acrid

    try {
      const res = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          title_ja: title, // title_ko と同じにする
          artist,
          acrcloud_music_id: acrid,
        }),
      })

      const resData = await res.json()
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setRegisterError('曲の登録には管理者ログインが必要です。ログイン後に再度お試しください。')
        } else {
          setRegisterError(resData.error || '登録に失敗しました')
        }
        setRegistering(false)
        return
      }

      router.push(`/admin/songs/${resData.song.id}`)
    } catch (e) {
      setRegisterError(String(e))
      setRegistering(false)
    }
  }

  // Extract metadata safely outside the JSX tree to prevent eslint warnings
  const music = unregisteredInfo?.metadata?.music?.[0]
  const title = music?.title
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artists = (music?.artists as any[])?.map((a) => a.name).join(' / ') || 'Unknown'
  const albumName = music?.album?.name
  const acrid = music?.acrid
  const score = music?.score
  const releaseDate = music?.release_date

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

        {uiState === 'fail_unregistered' && unregisteredInfo && (
          <div className="flex flex-col items-center gap-6 max-w-sm w-full bg-gray-900 border border-gray-850 rounded-2xl p-6">
            <div className="w-16 h-16 rounded-full bg-yellow-900/20 flex items-center justify-center border border-yellow-800/30">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            
            <div className="w-full text-center space-y-1">
              <p className="text-white font-semibold text-lg">未登録の曲です</p>
              <p className="text-gray-400 text-xs">この曲はまだ賛美カナルビに登録されていません。</p>
            </div>

            {/* ACRCloud 識別情報 */}
            {music && (
              <div className="w-full bg-gray-950 rounded-xl p-4 text-left text-xs font-mono space-y-1.5 border border-gray-800/50">
                <p className="text-gray-400">
                  <span className="text-gray-500 font-semibold">Title:</span>{' '}
                  <span className="text-white font-sans">{title}</span>
                </p>
                <p className="text-gray-400">
                  <span className="text-gray-500 font-semibold">Artist:</span>{' '}
                  <span className="text-white font-sans">{artists}</span>
                </p>
                {albumName && (
                  <p className="text-gray-400">
                    <span className="text-gray-500 font-semibold">Album:</span>{' '}
                    <span className="text-white font-sans">{albumName}</span>
                  </p>
                )}
                <p className="text-gray-400">
                  <span className="text-gray-500 font-semibold">ACRID:</span>{' '}
                  <span className="text-gray-300 select-all">{acrid}</span>
                </p>
                <p className="text-gray-400">
                  <span className="text-gray-500 font-semibold">Score:</span>{' '}
                  <span className="text-white font-bold">{score ?? 'N/A'}</span>
                </p>
                {releaseDate && (
                  <p className="text-gray-400">
                    <span className="text-gray-500 font-semibold">Release:</span>{' '}
                    <span className="text-white">{releaseDate}</span>
                  </p>
                )}
              </div>
            )}

            {/* 歌詞検索補助リンク */}
            {music && (
              <LyricSearchHelper title={title} artist={artists} />
            )}

            {registerError && (
              <p className="text-red-400 text-xs text-center">{registerError}</p>
            )}

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={handleRegisterSong}
                disabled={registering}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm"
              >
                {registering ? '登録中…' : 'この曲を登録する'}
              </button>
              <button
                onClick={handleRetry}
                disabled={registering}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm"
              >
                もう一度聞き取る
              </button>
              <button
                onClick={() => {
                  router.push('/songs')
                  reset()
                  setUiState('idle')
                }}
                disabled={registering}
                className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors text-xs"
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
