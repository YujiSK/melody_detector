import { NextRequest, NextResponse } from 'next/server'
import { recognizeAudio, type ACRResult } from '@/lib/acrcloud'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const formData = await request.formData()
  const audioFile = formData.get('audio') as Blob
  if (!audioFile) return NextResponse.json({ error: 'No audio provided' }, { status: 400 })

  // ACRCloud送信
  let result: ACRResult
  try {
    result = await recognizeAudio(audioFile)
  } catch {
    return NextResponse.json({ recognized: false, message: 'ACRCloud connection failed' })
  }

  // 認識ログ記録
  const acrMatch = result.metadata?.music?.[0]
  await supabase.from('recognition_logs').insert({
    user_id: user.id,
    church_id: profile.church_id,
    recognized: result.status.code === 0 && !!acrMatch,
    acrcloud_music_id: acrMatch?.acrid ?? null,
    matched_song_id: null,
  })

  if (result.status.code !== 0 || !acrMatch) {
    return NextResponse.json({
      recognized: false,
      message: result.status.msg,
      acrcloud_raw: result,
    })
  }

  const acrId = acrMatch.acrid

  // Supabase で曲検索
  const { data: song } = await supabase
    .from('songs')
    .select('id, title, title_ja, status')
    .eq('church_id', profile.church_id)
    .eq('acrcloud_music_id', acrId)
    .single()

  if (!song) {
    return NextResponse.json({
      recognized: true,
      registered: false,
      acrcloud_music_id: acrId,
      title: acrMatch.title,
      artist: acrMatch.artists?.[0]?.name ?? null,
      acrcloud_raw: result,
    })
  }

  // マッチログ更新
  await supabase.from('recognition_logs')
    .update({ matched_song_id: song.id })
    .eq('user_id', user.id)
    .eq('acrcloud_music_id', acrId)
    .order('created_at', { ascending: false })
    .limit(1)

  // 閲覧履歴を user_song_activity に記録
  await supabase.from('user_song_activity').upsert({
    user_id: user.id,
    song_id: song.id,
    last_viewed_at: new Date().toISOString(),
    view_count: 1,
  }, {
    onConflict: 'user_id,song_id',
    ignoreDuplicates: false,
  })

  return NextResponse.json({
    recognized: true,
    registered: true,
    song_id: song.id,
    title: song.title,
    title_ja: song.title_ja,
    status: song.status,
    acrcloud_raw: result,
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'recognize api alive',
  })
}
