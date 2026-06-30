import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, church_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title_ko, title, title_ja, artist, acrcloud_music_id, acrcloud_external_id, is_active, status } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}
  if (title_ko !== undefined || title !== undefined) {
    updateData.title_ko = title_ko !== undefined ? title_ko : title
  }
  if (title_ja !== undefined) updateData.title_ja = title_ja
  if (artist !== undefined) updateData.artist = artist
  if (acrcloud_music_id !== undefined) updateData.acrcloud_music_id = acrcloud_music_id
  if (acrcloud_external_id !== undefined) updateData.acrcloud_external_id = acrcloud_external_id
  
  if (is_active !== undefined) {
    updateData.is_active = is_active
  } else if (status !== undefined) {
    updateData.is_active = status === 'ready'
  }

  const { data, error } = await supabase
    .from('songs')
    .update(updateData)
    .eq('id', id)
    .eq('church_id', profile.church_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ song: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id)
    .eq('church_id', profile.church_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
