import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const songId = 'e7784fb9-31ab-443b-ab5f-d233e720deef'

  try {
    const { error: matErr } = await supabase
      .from('song_materials')
      .delete()
      .eq('song_id', songId)

    const { error: songErr } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)

    return NextResponse.json({
      ok: true,
      message: 'Cleanup E2E test data completed',
      materials_deleted: !matErr,
      song_deleted: !songErr
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
