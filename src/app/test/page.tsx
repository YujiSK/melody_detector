'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { createClient } from '@/lib/supabase/client'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  acrcloud_raw?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error_detail?: any
  supabase_matched?: boolean
  supabase_skipped?: boolean
  skipped_reason?: string
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
  const router = useRouter()
  const { state: recState, error: recError, start, reset } = useAudioRecorder()

  const [supabase, setSupabase] = useState<CheckResult | null>(null)
  const [clientOrigin, setClientOrigin] = useState('')
  const [diagnoseGet, setDiagnoseGet] = useState<string>('')
  const [diagnosePost, setDiagnosePost] = useState<string>('')

  // ユーザー状態診断用のステート
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testUser, setTestUser] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testProfile, setTestProfile] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testChurch, setTestChurch] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    async function loadTestUser() {
      const clientSupabase = createClient()
      try {
        const { data: { user } } = await clientSupabase.auth.getUser()
        if (user) {
          setTestUser(user)
          const { data: prof } = await clientSupabase
            .from('profiles')
            .select('display_name, role, church_id')
            .eq('id', user.id)
            .single()

          if (prof) {
            setTestProfile(prof)
            if (prof.church_id) {
              const { data: ch } = await clientSupabase
                .from('churches')
                .select('name')
                .eq('id', prof.church_id)
                .single()
              setTestChurch(ch)
            }
          }
        }
      } catch (e) {
        console.error('Error loading test user in TestPage:', e)
      } finally {
        setLoadingUser(false)
      }
    }
    loadTestUser()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      Promise.resolve().then(() => {
        setClientOrigin(origin)
      })
    }
  }, [])

  // 初期セットアップ用のステートと関数
  const [settingUp, setSettingUp] = useState(false)
  const [setupLogs, setSetupLogs] = useState<string[]>([])
  const [setupError, setSetupError] = useState('')

  async function runInitialSetup() {
    setSettingUp(true)
    setSetupError('')
    setSetupLogs([])
    try {
      const res = await fetch('/api/setup/initial', { method: 'POST' })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        setSetupError(`Non-JSON Response received (HTTP ${res.status}): ${text.substring(0, 300)}...`)
        return
      }

      const data = await res.json()
      if (data.ok) {
        setSetupLogs(data.logs || ['初期セットアップが完了しました'])
        window.location.reload()
      } else {
        setSetupError(data.reason || '初期セットアップに失敗しました')
        if (data.logs) setSetupLogs(data.logs)
      }
    } catch (e) {
      setSetupError(String(e))
    } finally {
      setSettingUp(false)
    }
  }

  async function runDiagnostics() {
    setDiagnoseGet('実行中…')
    setDiagnosePost('実行中…')

    try {
      const getRes = await fetch('/api/recognize', { method: 'GET' })
      const getText = await getRes.text()
      setDiagnoseGet(`Status: ${getRes.status}\nBody: ${getText}`)
    } catch (e) {
      setDiagnoseGet(`Error: ${String(e)}`)
    }

    try {
      const postRes = await fetch('/api/recognize', { method: 'POST' })
      const postText = await postRes.text()
      setDiagnosePost(`Status: ${postRes.status}\nBody: ${postText}`)
    } catch (e) {
      setDiagnosePost(`Error: ${String(e)}`)
    }
  }
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

        {/* ホスト・デプロイ診断 */}
        <Section title="Vercelホスト・API疎通診断">
          <div className="space-y-2 text-xs">
            <p className="text-gray-400">
              <span className="font-semibold text-white">location.origin:</span> {clientOrigin || '取得中…'}
            </p>
            <p className="text-gray-400">
              <span className="font-semibold text-white">fetch target URL:</span> {clientOrigin ? `${clientOrigin}/api/recognize` : '取得中…'}
            </p>
            <button
              onClick={runDiagnostics}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              診断APIを実行
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-gray-500 block mb-1">GET /api/recognize</span>
                <pre className="text-gray-300 bg-gray-950 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono leading-tight max-h-32">
                  {diagnoseGet || '未実行'}
                </pre>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">POST /api/recognize (空)</span>
                <pre className="text-gray-300 bg-gray-950 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono leading-tight max-h-32">
                  {diagnosePost || '未実行'}
                </pre>
              </div>
            </div>
          </div>
        </Section>

        {/* ログインユーザー状態診断 */}
        <Section title="ログインユーザー状態診断">
          {loadingUser ? (
            <p className="text-gray-400 text-xs animate-pulse font-mono">診断中…</p>
          ) : !testUser ? (
            <div className="space-y-2 text-xs">
              <p className="text-red-400 font-semibold font-sans">ログインしていません (Unauthorized)</p>
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
              >
                ログイン画面へ
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono">
              {!testProfile && (
                <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-2.5 text-yellow-400 font-sans leading-relaxed space-y-2 text-left">
                  <p>⚠️ <strong>プロファイル未検出</strong>: profiles レコードが存在しません。新規曲登録や管理者APIへの最初のリクエスト時に自動作成されます。</p>
                  <button
                    onClick={runInitialSetup}
                    disabled={settingUp}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-[11px] px-2.5 py-1 rounded transition-colors font-medium cursor-pointer font-sans"
                  >
                    {settingUp ? 'セットアップ実行中…' : '今すぐ初期セットアップを実行する'}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                <div className="text-gray-500">Auth Status:</div>
                <div className="text-green-400 font-semibold">Logged In</div>
                
                <div className="text-gray-500">User ID:</div>
                <div className="text-white truncate select-all">{testUser.id}</div>
                
                <div className="text-gray-500">Email:</div>
                <div className="text-white select-all">{testUser.email}</div>
                
                <div className="text-gray-500">Display Name:</div>
                <div className="text-white">{testProfile?.display_name ?? 'N/A'}</div>
                
                <div className="text-gray-500">Church ID:</div>
                <div className="text-white truncate select-all">{testProfile?.church_id ?? 'N/A'}</div>
                
                <div className="text-gray-500">Church Name:</div>
                <div className="text-white">{testChurch?.name ?? 'N/A'}</div>
                
                <div className="text-gray-500">DB Profile Role:</div>
                <div className="text-white font-bold">{testProfile?.role ?? 'none'}</div>
                
                <div className="text-gray-500">Is Admin (Effective):</div>
                <div className="text-white font-bold">
                  {(process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || testProfile?.role === 'admin') ? 'true' : 'false'}
                </div>

                <div className="text-gray-500">MVP Admin Mode:</div>
                <div className={process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ? "text-green-400 font-bold" : "text-gray-500"}>
                  {process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ? 'ON (Bypassed)' : 'OFF'}
                </div>
                
                <div className="text-gray-500">App Version:</div>
                <div className="text-gray-400">v0.1.1</div>
              </div>

              <div className="mt-3.5 pt-3.5 border-t border-gray-800 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">初期セットアップ（手動実行）</span>
                  <button
                    onClick={runInitialSetup}
                    disabled={settingUp}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer font-sans"
                  >
                    {settingUp ? 'セットアップ実行中…' : '初期セットアップを実行'}
                  </button>
                </div>
                {setupError && (
                  <p className="text-red-400 text-xs font-sans">エラー: {setupError}</p>
                )}
                {setupLogs.length > 0 && (
                  <pre className="text-gray-400 text-[10px] bg-gray-950 rounded p-2 font-mono max-h-40 overflow-y-auto leading-tight">
                    {setupLogs.join('\n')}
                  </pre>
                )}
              </div>
            </div>
          )}
        </Section>

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
              {/* ACRCloud 生レスポンスとデバッグ情報 */}
              {(recognize.acrcloud_raw || recognize.debug || recognize.error_detail) && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-3 text-xs text-left">
                  <p className="text-gray-400 font-semibold font-mono text-sm">ACRCloud 接続・解析デバッグ情報</p>

                  {/* 例外エラー情報 */}
                  {recognize.error_detail && (
                    <div className="bg-red-950/40 border border-red-900 rounded p-2.5 space-y-1">
                      <p className="text-red-400 font-bold font-mono">
                        例外検知: [{recognize.error_detail.name}] {recognize.error_detail.message}
                      </p>
                      {recognize.error_detail.stack && (
                        <pre className="text-red-300/80 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto leading-tight">
                          {recognize.error_detail.stack}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* ステータス・ファイル詳細 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-gray-400">
                    <div>HTTP Status (ACR): <span className="text-white font-bold">{recognize.debug?.http_status ?? 'N/A'}</span></div>
                    <div>ACR Status Code: <span className="text-white font-bold">{recognize.acrcloud_raw?.status?.code ?? 'N/A'}</span></div>
                    <div>ACR Status Msg: <span className="text-white font-bold">{recognize.acrcloud_raw?.status?.msg ?? 'N/A'}</span></div>
                    <div>ACR Version: <span className="text-white">{recognize.acrcloud_raw?.status?.version ?? 'N/A'}</span></div>
                    <div>metadata.music: <span className={recognize.acrcloud_raw?.metadata?.music ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{recognize.acrcloud_raw?.metadata?.music ? 'YES' : 'NO'}</span></div>
                    
                    {/* プロファイルおよびSupabase照合ステータス */}
                    <div>Profile Status: <span className={recognize.supabase_skipped ? "text-yellow-400 font-semibold" : "text-green-400 font-semibold"}>{recognize.supabase_skipped ? 'Not Found' : 'OK'}</span></div>
                    <div>Supabase Matched: <span className="text-white font-bold">{recognize.supabase_matched ? 'YES' : 'NO'}</span></div>
                    <div>Supabase Skipped: <span className="text-white font-bold">{recognize.supabase_skipped ? 'YES' : 'NO'}</span></div>
                    {recognize.supabase_skipped && (
                      <div className="col-span-2 text-yellow-400 font-semibold">Skipped Reason: <span className="text-white font-normal">{recognize.skipped_reason ?? 'N/A'}</span></div>
                    )}

                    <div>Received File Size: <span className="text-white">{recognize.debug?.received_file_size ? `${(recognize.debug.received_file_size / 1024).toFixed(1)} KB` : 'N/A'}</span></div>
                    <div>Received File Type: <span className="text-white">{recognize.debug?.received_file_type ?? 'N/A'}</span></div>
                    <div>FormData Keys: <span className="text-white">{recognize.debug?.form_data_keys?.join(', ') ?? 'N/A'}</span></div>
                    <div>sample_bytes (Buffer): <span className="text-white font-bold">{recognize.debug?.sample_bytes ?? 'N/A'}</span></div>
                    <div>timestamp: <span className="text-white">{recognize.debug?.timestamp ?? 'N/A'}</span></div>
                    <div className="col-span-2 truncate">Request URL: <span className="text-white">{recognize.debug?.request_url ?? 'N/A'}</span></div>
                  </div>

                  {/* 署名対象文字列 */}
                  {recognize.debug?.string_to_sign && (
                    <div className="space-y-1">
                      <span className="text-gray-500 block font-mono text-[10px]">string_to_sign (access_secret excluded):</span>
                      <pre className="text-gray-300 bg-gray-950 rounded p-1.5 font-mono text-[10px] whitespace-pre overflow-x-auto leading-tight">
                        {recognize.debug.string_to_sign}
                      </pre>
                    </div>
                  )}

                  {/* 生 JSON レスポンス */}
                  {recognize.acrcloud_raw && (
                    <div className="space-y-1">
                      <span className="text-gray-500 block font-mono text-[10px]">Raw JSON Response:</span>
                      <pre className="text-gray-300 bg-gray-950 rounded p-2 overflow-auto font-mono text-[10px] max-h-40 leading-tight">
                        {JSON.stringify(recognize.acrcloud_raw, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* 生レスポンス テキスト (非JSONエラー用) */}
                  {recognize.debug?.response_text && !recognize.acrcloud_raw && (
                    <div className="space-y-1">
                      <span className="text-gray-500 block font-mono text-[10px]">Response Text (Non-JSON):</span>
                      <pre className="text-gray-300 bg-gray-950 rounded p-2 overflow-auto font-mono text-[10px] max-h-40 leading-tight">
                        {recognize.debug.response_text}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
