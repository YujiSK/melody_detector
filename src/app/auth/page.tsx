'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('確認メールを送信しました。メールを確認してください。')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold">賛美カナルビ</h1>
          <p className="text-gray-400 text-sm mt-1">韓国賛美 音声認識システム</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />

          {message && (
            <p className="text-sm text-center text-yellow-400">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? '…' : mode === 'login' ? 'ログイン' : '登録'}
          </button>
        </form>

        <button
          onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
          className="w-full mt-4 text-gray-400 text-sm hover:text-gray-200 transition-colors"
        >
          {mode === 'login' ? '新規登録はこちら' : 'ログインはこちら'}
        </button>
      </div>
    </div>
  )
}
