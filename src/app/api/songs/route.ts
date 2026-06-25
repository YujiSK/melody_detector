import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const q = request.nextUrl.searchParams.get('q') || ''

  let query = supabase
    .from('songs')
    .select('id, title, title_ja, artist, status, created_at')
    .eq('church_id', profile.church_id)
    .eq('status', 'ready')
    .order('title')

  if (q) {
    query = query.or(`title.ilike.%${q}%,title_ja.ilike.%${q}%,artist.ilike.%${q}%`)
  }

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ songs: data })
}
