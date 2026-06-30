import { NextResponse } from 'next/server'
import { recognizeAudio, type ACRResult } from '@/lib/acrcloud'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'recognize api alive',
  })
}

export async function POST(req: Request) {
  let formData: FormData | null = null
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({
      recognized: false,
      error: 'No audio file',
      debug: true,
    }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!(audioFile instanceof Blob)) {
    return NextResponse.json({
      recognized: false,
      error: 'No audio file',
      debug: true,
    }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id')
    .eq('id', user.id)
    .single()
  if (!profile) {
    return NextResponse.json({
      recognized: false,
      error: 'Profile not found',
      debug: true,
    }, { status: 403 })
  }

  let result: ACRResult
  try {
    result = await recognizeAudio(audioFile)
  } catch {
    return NextResponse.json({ recognized: false, message: 'ACRCloud connection failed' })
  }

  const acrMatch = result.metadata?.music?.[0]
  await supabase.from('recognition_logs').insert({
    user_id: user.id,
    church_id: profile.church_id,
    recognized: result.status.code === 0 && !!acrMatch,
    acrcloud_music_id: acrMatch?.acrid ?? null,
    matched_song_id: null,
  })

  if (result.status.code !== 0 || !acrMatch) {
    return NextResponse.json({ recognized: false, message: result.status.msg })
  }

  const acrId = acrMatch.acrid

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, title_ko, title_ja, is_active')
    .eq('church_id', profile.church_id)
    .eq('acrcloud_music_id', acrId)
    .maybeSingle()

  if (songError) {
    return NextResponse.json({ error: songError.message }, { status: 500 })
  }

  if (!song) {
    return NextResponse.json({
      recognized: true,
      registered: false,
      acrcloud_music_id: acrId,
      title: acrMatch.title,
      artist: acrMatch.artists?.[0]?.name ?? null,
    })
  }

  const { error: logUpdateError } = await supabase.from('recognition_logs')
    .update({ matched_song_id: song.id })
    .eq('user_id', user.id)
    .eq('acrcloud_music_id', acrId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (logUpdateError) {
    console.error('Failed to update recognition log:', logUpdateError)
  }

  const { error: activityError } = await supabase.from('user_song_activity').upsert({
    user_id: user.id,
    song_id: song.id,
    last_viewed_at: new Date().toISOString(),
    view_count: 1,
  }, {
    onConflict: 'user_id,song_id',
    ignoreDuplicates: false,
  })

  if (activityError) {
    console.error('Failed to upsert activity log:', activityError)
  }

  return NextResponse.json({
    recognized: true,
    registered: true,
    song_id: song.id,
    title: song.title_ko,
    title_ja: song.title_ja,
    status: song.is_active ? 'ready' : 'pending',
    is_active: song.is_active,
  })
}
