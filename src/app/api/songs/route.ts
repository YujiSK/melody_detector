import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const q = request.nextUrl.searchParams.get('q') || ''

  let query = supabase
    .from('songs')
    .select('id, title_ko, title_ja, artist, is_active, created_at')
    .eq('is_active', true)
    .order('title_ko')

  // 認証済みユーザー: church_id スコープで絞り込む
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('church_id')
      .eq('id', user.id)
      .single()
    if (profile) {
      query = query.eq('church_id', profile.church_id)
    }
  }

  if (q) {
    query = query.or(`title_ko.ilike.%${q}%,title_ja.ilike.%${q}%,artist.ilike.%${q}%`)
  }

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ songs: data })
}
