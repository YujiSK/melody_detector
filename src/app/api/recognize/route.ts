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

  const result: ACRResult = await recognizeAudio(audioFile)

  if (result.status.code !== 0 || !result.metadata?.music?.length) {
    return NextResponse.json({ recognized: false, message: result.status.msg })
  }

  const match = result.metadata.music[0]
  const acrId = match.acrid

  const { data: song } = await supabase
    .from('songs')
    .select('id, title, title_ja, status')
    .eq('church_id', profile.church_id)
    .eq('acr_id', acrId)
    .single()

  if (!song) {
    return NextResponse.json({
      recognized: true,
      registered: false,
      acr_id: acrId,
      title: match.title,
      artist: match.artists?.[0]?.name,
    })
  }

  return NextResponse.json({
    recognized: true,
    registered: true,
    song_id: song.id,
    title: song.title,
    title_ja: song.title_ja,
    status: song.status,
  })
}
