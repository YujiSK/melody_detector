import { NextRequest, NextResponse } from 'next/server'
import packageJson from '../../../../package.json'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    ok: true,
    appVersion: packageJson.version,
    buildCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'local-dev',
  })
}
