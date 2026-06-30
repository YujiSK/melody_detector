import { NextResponse } from 'next/server'
import { recognizeAudio, type ACRResult } from '@/lib/acrcloud'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext } from '@/lib/user-context'

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

  let result: ACRResult
  try {
    result = await recognizeAudio(audioFile)
  } catch {
    return NextResponse.json({
      recognized: false,
      message: 'ACRCloud connection failed',
      supabase_skipped: true,
      skipped_reason: 'acrcloud_connection_failed',
    })
  }

  const acrMatch = result.metadata?.music?.[0]
  const context = await getCurrentUserContext(user, { autoSetup: true })
  const contextReady = !!context.profile && !!context.member && !!context.churchId

  if (!contextReady) {
    return NextResponse.json({
      recognized: result.status.code === 0 && !!acrMatch,
      registered: false,
      acrcloud_music_id: acrMatch?.acrid ?? null,
      title: acrMatch?.title ?? null,
      artist: acrMatch?.artists?.[0]?.name ?? null,
      message: result.status.msg,
      supabase_matched: false,
      supabase_skipped: true,
      skipped_reason: 'user_context_not_resolved',
      acrcloud_raw: result,
      debug: context.debug,
    })
  }

  await supabase.from('recognition_logs').insert({
    user_id: user.id,
    church_id: context.churchId,
    recognized: result.status.code === 0 && !!acrMatch,
    acrcloud_music_id: acrMatch?.acrid ?? null,
    matched_song_id: null,
  })

  if (result.status.code !== 0 || !acrMatch) {
    return NextResponse.json({
      recognized: false,
      message: result.status.msg,
      supabase_matched: false,
      supabase_skipped: false,
      acrcloud_raw: result,
      debug: context.debug,
    })
  }

  const acrId = acrMatch.acrid

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, title_ko, title_ja, is_active')
    .eq('church_id', context.churchId)
    .eq('acrcloud_music_id', acrId)
    .maybeSingle()

  if (songError) {
    return NextResponse.json({
      recognized: true,
      registered: false,
      acrcloud_music_id: acrId,
      title: acrMatch.title,
      artist: acrMatch.artists?.[0]?.name ?? null,
      error: songError.message,
      supabase_matched: false,
      supabase_skipped: true,
      skipped_reason: 'song_lookup_failed',
      acrcloud_raw: result,
      debug: context.debug,
    }, { status: 500 })
  }

  if (!song) {
    return NextResponse.json({
      recognized: true,
      registered: false,
      acrcloud_music_id: acrId,
      title: acrMatch.title,
      artist: acrMatch.artists?.[0]?.name ?? null,
      supabase_matched: false,
      supabase_skipped: false,
      acrcloud_raw: result,
      debug: context.debug,
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
    supabase_matched: true,
    supabase_skipped: false,
    acrcloud_raw: result,
    debug: context.debug,
  })
}
