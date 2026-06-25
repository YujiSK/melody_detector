import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .eq('church_id', profile.church_id)
    .single()

  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: kana } = await supabase
    .from('kana')
    .select('*')
    .eq('song_id', id)
    .single()

  return NextResponse.json({ song, kana })
}
