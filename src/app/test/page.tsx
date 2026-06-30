'use client'

import { useEffect, useState } from 'react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { createClient } from '@/lib/supabase/client'
import PwaRecoveryPanel from '@/components/test/PwaRecoveryPanel'

type Status = 'idle' | 'ok' | 'error'

function StatusBadge({ status }: { status: Status }) {
  const cls = status === 'ok'
    ? 'bg-green-900/50 text-green-400'
    : status === 'error'
      ? 'bg-red-900/50 text-red-400'
      : 'bg-gray-800 text-gray-400'
  const label = status === 'ok' ? 'OK' : status === 'error' ? 'NG' : 'idle'
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
  const [authEmail, setAuthEmail] = useState('')
  const [authUserId, setAuthUserId] = useState('')
  const [diagnoseGet, setDiagnoseGet] = useState('')
  const [diagnosePost, setDiagnosePost] = useState('')
  const [diagnosePostFormData, setDiagnosePostFormData] = useState('')
  const [recognizeLog, setRecognizeLog] = useState<string[]>([])
  const [recognize, setRecognize] = useState<Record<string, unknown> | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    const clientSupabase = createClient()
    clientSupabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthEmail(user.email ?? '')
        setAuthUserId(user.id)
      }
    }).catch(() => {})
  }, [])

  const isRecording = recState === 'recording'
  const isProcessing = recState === 'processing'
  const fetchTargetUrl = origin ? `${origin}/api/recognize` : 'loading...'

  function addLog(message: string) {
    setRecognizeLog((prev) => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${message}`])
  }

  async function runDiagnostics() {
    setDiagnoseGet('running...')
    setDiagnosePost('running...')
    setDiagnosePostFormData('running...')
    const requestUrl = `${window.location.origin}/api/recognize`

    try {
      const getRes = await fetch(requestUrl, { method: 'GET', cache: 'no-store' })
      const getText = await getRes.text()
      setDiagnoseGet(`Request URL: ${requestUrl}\nStatus: ${getRes.status}\nResponse body: ${getText}`)
    } catch (error) {
      setDiagnoseGet(`Error: ${String(error)}`)
    }

    try {
      const postRes = await fetch(requestUrl, { method: 'POST' })
      const postText = await postRes.text()
      setDiagnosePost(`Request URL: ${requestUrl}\nStatus: ${postRes.status}\nResponse body: ${postText}`)
    } catch (error) {
      setDiagnosePost(`Error: ${String(error)}`)
    }

    try {
      const formData = new FormData()
      formData.append('debug', 'true')
      const postRes = await fetch(requestUrl, { method: 'POST', body: formData })
      const postText = await postRes.text()
      setDiagnosePostFormData(`Request URL: ${requestUrl}\nStatus: ${postRes.status}\nResponse body: ${postText}`)
    } catch (error) {
      setDiagnosePostFormData(`Error: ${String(error)}`)
    }
  }

  async function runFullRecognize() {
    setRecognize(null)
    setRecognizeLog([])
    addLog('Starting recognition...')

    try {
      const blob = await start(7000)
      addLog(`Recorded ${(blob.size / 1024).toFixed(1)} KB (${blob.type})`)
      addLog('Sending audio to /api/recognize...')

      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')

      const res = await fetch('/api/recognize', { method: 'POST', body: formData })
      const data = await res.json()
      setRecognize(data)
      addLog(`POST /api/recognize status: ${res.status}`)
    } catch (error) {
      addLog(`Error: ${String(error)}`)
      reset()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      <header className="border-b border-gray-800 px-4 pb-3 pt-4">
        <h1 className="text-lg font-bold text-white">Test Dashboard</h1>
        <p className="mt-0.5 text-xs text-gray-500">Supabase / ACRCloud / OpenAI / PWA diagnostics</p>
      </header>

      <div className="max-w-xl space-y-4 px-4 py-4">
        <PwaRecoveryPanel />

        <Section title="API Diagnostics">
          <div className="space-y-2 text-xs text-gray-300">
            <p><span className="font-semibold text-gray-400">location.origin:</span> <span suppressHydrationWarning>{origin || 'loading...'}</span></p>
            <p><span className="font-semibold text-gray-400">fetch target URL:</span> <span suppressHydrationWarning>{fetchTargetUrl}</span></p>
          </div>
          <button
            type="button"
            onClick={runDiagnostics}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Run API checks
          </button>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="mb-1 text-xs text-gray-500">GET /api/recognize</p>
              <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950 p-2 font-mono text-xs leading-tight text-gray-300">{diagnoseGet || 'not run yet'}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">POST /api/recognize (empty)</p>
              <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950 p-2 font-mono text-xs leading-tight text-gray-300">{diagnosePost || 'not run yet'}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">POST /api/recognize (FormData debug)</p>
              <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950 p-2 font-mono text-xs leading-tight text-gray-300">{diagnosePostFormData || 'not run yet'}</pre>
            </div>
          </div>
        </Section>

        <Section title="Auth">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
            <div className="text-gray-500">Signed In</div>
            <div className="font-semibold text-green-400">{authUserId ? 'true' : 'false'}</div>
            <div className="text-gray-500">User ID</div>
            <div className="break-all text-white">{authUserId || 'N/A'}</div>
            <div className="text-gray-500">Email</div>
            <div className="break-all text-white">{authEmail || 'N/A'}</div>
          </div>
        </Section>

        <Section title="Record and Recognize">
          <button
            type="button"
            onClick={runFullRecognize}
            disabled={isRecording || isProcessing}
            className={`w-full rounded-xl py-4 font-semibold text-white transition-colors ${isRecording ? 'bg-red-600' : isProcessing ? 'bg-yellow-700' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Start recognition'}
          </button>

          {recError && <p className="text-xs text-red-400">Recorder error: {recError}</p>}

          {recognizeLog.length > 0 && (
            <pre className="whitespace-pre-wrap rounded bg-gray-950 p-2 text-xs leading-relaxed text-gray-300">{recognizeLog.join('\n')}</pre>
          )}

          {recognize && (
            <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={recognize.recognized ? 'ok' : 'error'} />
                <span className="font-medium text-white">{recognize.recognized ? 'Recognized' : 'Not recognized'}</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-gray-950 p-2 text-xs text-gray-300">{JSON.stringify(recognize, null, 2)}</pre>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
