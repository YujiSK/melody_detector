import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseSections(val: any) {
  if (!val) return []
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch (e) {
      console.error('Failed to parse sections:', e)
      return []
    }
  }
  return val
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // church_members から所属教会を取得する（profilesにはchurch_idが存在しない）
  const { data: member } = await supabase
    .from('church_members')
    .select('church_id')
    .eq('user_id', user.id)
    .single()
    
  if (!member) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })

  const { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .eq('church_id', member.church_id)
    .single()
    
  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // フロントエンド互換のエイリアス title を付加
  const formattedSong = {
    ...song,
    title: song.title_ko
  }

  const { data: material } = await supabase
    .from('song_materials')
    .select('*')
    .eq('song_id', id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseJsonSafe(val: any) {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return []
      }
    }
    return val || []
  }

  const formattedMaterial = material ? {
    ...material,
    sections: parseJsonSafe(material.kanarubi_document),
    raw_korean: material.source_lyrics
  } : null

  // 閲覧履歴更新
  await supabase.from('user_song_activity').upsert({
    user_id: user.id,
    song_id: id,
    last_viewed_at: new Date().toISOString(),
    view_count: 1,
  }, { onConflict: 'user_id,song_id', ignoreDuplicates: false })

  const hasMaterial = !!(formattedMaterial && formattedMaterial.sections && formattedMaterial.sections.length > 0)
  return NextResponse.json({
    song: formattedSong,
    material: formattedMaterial,
    hasMaterial,
    isReady: hasMaterial,
    materialId: material?.id || null
  })
}
