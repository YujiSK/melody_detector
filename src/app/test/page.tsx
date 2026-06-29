'use client'

import { useState } from 'react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'

type Status = 'idle' | 'ok' | 'error'

interface CheckResult {
  status: Status
  message: string
  detail?: unknown
}

interface RecognizeResult {
  recognized: boolean
  registered?: boolean
  song_id?: string
  title?: string
  title_ja?: string
  acrcloud_music_id?: string
  artist?: string
  acr_status_code?: number
  acr_status_msg?: string
}

function StatusBadge({ status }: { status: Status }) {
  const cls = status === 'ok'
    ? 'bg-green-900/50 text-green-400'
    : status === 'error'
      ? 'bg-red-900/50 text-red-400'
      : 'bg-gray-800 text-gray-400'
  const label = status === 'ok' ? '✓ OK' : status === 'error' ? '✗ NG' : '—'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${cls}`}>{label}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 className="text-white font-semibold text-sm">{title}</h2>
      {children}
    </div>
  )
}

export default function TestPage() {
  const { state: recState, error: recError, start, reset } = useAudioRecorder()

  const [supabase, setSupabase] = useState<CheckResult | null>(null)
  const [openai, setOpenai] = useState<CheckResult | null>(null)
  const [acrCheck, setAcrCheck] = useState<CheckResult | null>(null)
  const [recognize, setRecognize] = useState<RecognizeResult | null>(null)
  const [recognizeLog, setRecognizeLog] = useState<string[]>([])

  const isRecording = recState === 'recording'
  const isProcessing = recState === 'processing'

  function addLog(msg: string) {
    setRecognizeLog(prev => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`])
  }

  async function checkSupabase() {
    setSupabase({ status: 'idle', message: '確認中…' })
    try {
      const res = await fetch('/api/test/supabase')
      const data = await res.json()
      if (data.ok) {
        const tableLines = Object.entries(data.tables as Record<string, string>)
          .map(([t, s]) => `${t}: ${s}`)
          .join('\n')
        setSupabase({ status: 'ok', message: `接続成功\n${tableLines}`, detail: data })
      } else {
        setSupabase({ status: 'error', message: data.error, detail: data })
      }
    } catch (e) {
      setSupabase({ status: 'error', message: String(e) })
    }
  }

  async function checkOpenAI() {
    setOpenai({ status: 'idle', message: '確認中（数秒かかります）…' })
    try {
      const res = await fetch('/api/test/openai')
      const data = await res.json()
      if (data.ok) {
        setOpenai({
          status: 'ok',
          message: `モデル: ${data.model}\n変換結果: ${JSON.stringify(data.result)}\nトークン: ${data.usage?.total_tokens}`,
          detail: data,
        })
      } else {
        setOpenai({ status: 'error', message: data.error, detail: data })
      }
    } catch (e) {
      setOpenai({ status: 'error', message: String(e) })
    }
  }

  async function checkACRConfig() {
    setAcrCheck({ status: 'idle', message: '確認中…' })
    try {
      const res = await fetch('/api/test/acrcloud')
      const data = await res.json()
      if (data.ok) {
        setAcrCheck({
          status: 'ok',
          message: `Host: ${data.host}\nKey: ${data.access_key_prefix}\nSecret: 設定済み`,
          detail: data,
        })
      } else {
        setAcrCheck({ status: 'error', message: data.error })
      }
    } catch (e) {
      setAcrCheck({ status: 'error', message: String(e) })
    }
  }

  async function runFullRecognize() {
    setRecognize(null)
    setRecognizeLog([])
    addLog('録音開始（7秒）')

    try {
      const blob = await start(7000)
      addLog(`録音完了 (${(blob.size / 1024).toFixed(1)} KB, ${blob.type})`)
      addLog('ACRCloud + Supabase照合 送信中…')

      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')

      const res = await fetch('/api/recognize', { method: 'POST', body: formData })
      const data: RecognizeResult = await res.json()

      if (!data.recognized) {
        addLog(`認識失敗: ${data.acr_status_msg || '不明'}`)
        setRecognize(data)
      } else if (!data.registered) {
        addLog(`認識成功 → Supabase未登録 (acrid: ${data.acrcloud_music_id})`)
        addLog(`曲名: ${data.title}${data.artist ? ` / ${data.artist}` : ''}`)
        setRecognize(data)
      } else {
        addLog(`認識成功 → Supabase登録済み ✓`)
        addLog(`song_id: ${data.song_id}`)
        addLog(`曲名: ${data.title}${data.title_ja ? ` (${data.title_ja})` : ''}`)
        setRecognize(data)
      }
    } catch (e) {
      addLog(`エラー: ${String(e)}`)
      reset()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <header className="px-4 pt-4 pb-3 border-b border-gray-800">
        <h1 className="text-white font-bold text-lg">疎通テスト</h1>
        <p className="text-gray-500 text-xs mt-0.5">Supabase / ACRCloud / OpenAI 接続確認</p>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-xl">

        {/* Supabase */}
        <Section title="Supabase">
          <div className="flex items-center justify-between">
            <StatusBadge status={supabase?.status ?? 'idle'} />
            <button
              onClick={checkSupabase}
              className="text-blue-400 text-sm hover:text-blue-300"
            >
              テスト実行
            </button>
          </div>
          {supabase && (
            <pre className="text-gray-300 text-xs bg-gray-950 rounded p-2 whitespace-pre-wrap break-all">
              {supabase.message}
            </pre>
          )}
        </Section>

        {/* ACRCloud 設定確認 */}
        <Section title="ACRCloud 設定">
          <div className="flex items-center justify-between">
            <StatusBadge status={acrCheck?.status ?? 'idle'} />
            <button
              onClick={checkACRConfig}
              className="text-blue-400 text-sm hover:text-blue-300"
            >
              設定確認
            </button>
          </div>
          {acrCheck && (
            <pre className="text-gray-300 text-xs bg-gray-950 rounded p-2 whitespace-pre-wrap">
              {acrCheck.message}
            </pre>
          )}
        </Section>

        {/* OpenAI */}
        <Section title="OpenAI (gpt-4o)">
          <div className="flex items-center justify-between">
            <StatusBadge status={openai?.status ?? 'idle'} />
            <button
              onClick={checkOpenAI}
              className="text-blue-400 text-sm hover:text-blue-300"
            >
              テスト実行
            </button>
          </div>
          {openai && (
            <pre className="text-gray-300 text-xs bg-gray-950 rounded p-2 whitespace-pre-wrap">
              {openai.message}
            </pre>
          )}
        </Section>

        {/* 音声認識フルテスト */}
        <Section title="録音 → ACRCloud → Supabase照合">
          <p className="text-gray-400 text-xs">
            ボタンを押して7秒間、認識させたい曲を流してください。
            ACRCloudで認識後、Supabaseの songs テーブルと照合します。
          </p>
          <button
            onClick={runFullRecognize}
            disabled={isRecording || isProcessing}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all
              ${isRecording
                ? 'bg-red-600 animate-pulse cursor-not-allowed'
                : isProcessing
                  ? 'bg-yellow-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
              }`}
          >
            {isRecording
              ? '録音中…（7秒）'
              : isProcessing
                ? '送信・照合中…'
                : '録音開始（7秒）'}
          </button>

          {recError && (
            <p className="text-red-400 text-xs">マイクエラー: {recError}</p>
          )}

          {/* ログ */}
          {recognizeLog.length > 0 && (
            <pre className="text-gray-300 text-xs bg-gray-950 rounded p-2 whitespace-pre-wrap leading-relaxed">
              {recognizeLog.join('\n')}
            </pre>
          )}

          {/* 結果 */}
          {recognize && (
            <div className={`rounded-xl p-3 text-sm ${
              !recognize.recognized
                ? 'bg-red-900/30 border border-red-800'
                : recognize.registered
                  ? 'bg-green-900/30 border border-green-800'
                  : 'bg-yellow-900/30 border border-yellow-800'
            }`}>
              {!recognize.recognized && (
                <p className="text-red-300 font-medium">認識失敗</p>
              )}
              {recognize.recognized && !recognize.registered && (
                <>
                  <p className="text-yellow-300 font-medium">認識成功 / Supabase未登録</p>
                  <p className="text-gray-300 text-xs mt-1">
                    「{recognize.title}」は認識できましたが、このチャーチには登録されていません。
                    管理画面で登録してください。
                  </p>
                  <p className="text-gray-500 text-xs font-mono mt-1 break-all">
                    acrid: {recognize.acrcloud_music_id}
                  </p>
                </>
              )}
              {recognize.recognized && recognize.registered && (
                <>
                  <p className="text-green-300 font-medium">認識成功 / Supabase登録済み ✓</p>
                  <p className="text-white mt-1">{recognize.title}</p>
                  {recognize.title_ja && <p className="text-gray-400 text-xs">{recognize.title_ja}</p>}
                  <a
                    href={`/songs/${recognize.song_id}`}
                    className="inline-block mt-2 text-blue-400 text-xs underline"
                  >
                    カナルビを見る →
                  </a>
                </>
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
