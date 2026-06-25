import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 })
  }

  try {
    const supabase = await createClient()

    // 各テーブルの存在確認（count=0でRLSに関わらず疎通確認）
    const tables = ['churches', 'profiles', 'songs', 'song_materials', 'user_song_activity', 'recognition_logs']
    const results: Record<string, string> = {}

    for (const table of tables) {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      results[table] = error ? `error: ${error.message}` : 'ok'
    }

    return NextResponse.json({
      ok: true,
      url_prefix: url.slice(0, 30) + '…',
      tables: results,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
