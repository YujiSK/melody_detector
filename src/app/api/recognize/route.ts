import { NextRequest, NextResponse } from 'next/server'
import { recognizeAudio, type ACRResult } from '@/lib/acrcloud'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debugInfo: any = {
    received_file_size: 0,
    received_file_type: '',
    form_data_keys: [],
    sample_bytes: 0,
    timestamp: '',
    string_to_sign: '',
    request_url: '',
    http_status: 0,
    response_text: '',
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    debugInfo.form_data_keys = Array.from(formData.keys())

    const audioFile = formData.get('audio') as Blob

    // If no audio file is provided (e.g. empty diagnostic post check), return alive check response
    if (!audioFile) {
      return NextResponse.json({
        ok: true,
        message: "recognize api alive",
        method: "POST",
        debug: debugInfo
      })
    }

    debugInfo.received_file_size = audioFile.size
    debugInfo.received_file_type = audioFile.type

    // Convert Blob to Node.js Buffer and calculate actual byte length
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    debugInfo.sample_bytes = buffer.byteLength

    // Step 1: Run ACRCloud audio recognition first
    let result: ACRResult
    try {
      result = await recognizeAudio(buffer, audioFile.type, debugInfo)
    } catch (acrErr) {
      const error = acrErr as Error
      return NextResponse.json({
        recognized: false,
        message: 'ACRCloud fetch exception occurred',
        error_detail: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        debug: debugInfo
      })
    }

    // Step 2: Fetch user profile (church_id) from Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('church_id')
      .eq('id', user.id)
      .single()

    const hasProfile = !!profile
    const acrMatch = result.metadata?.music?.[0]

    // Step 3: If user profile is missing, skip Supabase matching but return ACRCloud raw results
    if (!hasProfile) {
      return NextResponse.json({
        recognized: result.status.code === 0 && !!acrMatch,
        registered: false,
        supabase_matched: false,
        supabase_skipped: true,
        skipped_reason: 'Profile (church_id) not found for current user',
        title: acrMatch?.title ?? null,
        artist: acrMatch?.artists?.[0]?.name ?? null,
        acrcloud_raw: result,
        debug: debugInfo
      })
    }

    // Step 4: Profile exists, record logs
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
        message: result.status.msg || `ACRCloud failed with code ${result.status.code}`,
        acrcloud_raw: result,
        debug: debugInfo
      })
    }

    const acrId = acrMatch.acrid

    // Step 5: Match against church registered songs
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
        supabase_matched: false,
        acrcloud_music_id: acrId,
        title: acrMatch.title,
        artist: acrMatch.artists?.[0]?.name ?? null,
        acrcloud_raw: result,
        debug: debugInfo
      })
    }

    // Update matched logs
    await supabase.from('recognition_logs')
      .update({ matched_song_id: song.id })
      .eq('user_id', user.id)
      .eq('acrcloud_music_id', acrId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Log viewing activity
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
      supabase_matched: true,
      song_id: song.id,
      title: song.title,
      title_ja: song.title_ja,
      status: song.status,
      acrcloud_raw: result,
      debug: debugInfo
    })

  } catch (err) {
    const error = err as Error
    return NextResponse.json({
      recognized: false,
      message: 'Global API handler exception occurred',
      error_detail: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      debug: debugInfo
    })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'recognize api alive',
  })
}
