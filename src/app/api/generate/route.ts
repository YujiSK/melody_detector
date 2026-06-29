import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return null
  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
  if (!disableAuth && profile.role !== 'admin') return null
  return profile
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { korean_lyrics } = body
    if (!korean_lyrics?.trim()) {
      return NextResponse.json({ error: 'korean_lyrics required' }, { status: 400 })
    }

    const sections = await generateKana(korean_lyrics)
    return NextResponse.json({ sections })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
