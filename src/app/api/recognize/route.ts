import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: 'recognize api alive',
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'recognize api alive',
  })
}
