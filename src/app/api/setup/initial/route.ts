import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureInitialSetup } from '@/lib/user-context'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'setup initial api alive',
  })
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({
        error: 'Forbidden',
        reason: 'No authenticated user session found',
      }, { status: 403 })
    }

    const result = await ensureInitialSetup(user)

    return NextResponse.json({
      ok: true,
      message: 'Initial setup completed successfully',
      logs: result.logs,
      profile: result.profile,
      member: result.member,
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json({
      ok: false,
      error: 'Setup failed',
      reason: error.message,
      debug: {
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
        envKeys: Object.keys(process.env).filter((key) => key.includes('SUPABASE')),
      },
    }, { status: 500 })
  }
}
