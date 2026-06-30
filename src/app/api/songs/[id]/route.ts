import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 認証済みユーザー: church_id スコープで取得 + 閲覧履歴記録
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('church_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      const { data: song, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .eq('church_id', profile.church_id)
        .maybeSingle()
      if (songError || !song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const { data: material, error: matError } = await supabase
        .from('song_materials')
        .select('*')
        .eq('song_id', id)
        .maybeSingle()
      if (matError) return NextResponse.json({ error: matError.message }, { status: 500 })

      // 閲覧履歴更新（失敗しても曲表示には影響させない）
      try {
        await supabase.from('user_song_activity').upsert({
          user_id: user.id,
          song_id: id,
          last_viewed_at: new Date().toISOString(),
          view_count: 1,
        }, { onConflict: 'user_id,song_id', ignoreDuplicates: false })
      } catch {
        // 閲覧履歴の更新失敗は無視
      }

      return NextResponse.json({ song, material })
    }
  }

  // 未認証 or プロフィール未作成: 公開曲（is_active=true）のみ取得
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (songError || !song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: material, error: matError } = await supabase
    .from('song_materials')
    .select('*')
    .eq('song_id', id)
    .maybeSingle()
  if (matError) return NextResponse.json({ error: matError.message }, { status: 500 })

  return NextResponse.json({ song, material })
}
