import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 本番では /test ページごと削除するか、Admin認証を追加すること
export async function GET() {
  const host = process.env.ACRCLOUD_HOST
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY
  const secretKey = process.env.ACRCLOUD_ACCESS_SECRET

  const missing = [
    !host && 'ACRCLOUD_HOST',
    !accessKey && 'ACRCLOUD_ACCESS_KEY',
    !secretKey && 'ACRCLOUD_ACCESS_SECRET',
  ].filter(Boolean)

  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: `Missing env: ${missing.join(', ')}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    host,
    access_key_prefix: accessKey!.slice(0, 6) + '…',
    secret_configured: true,
    endpoint: `https://${host}/v1/identify`,
  })
}

// POST: 実際に空音声で叩いてHTTP疎通を確認
export async function POST(request: NextRequest) {
  const host = process.env.ACRCLOUD_HOST!
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY!
  const secretKey = process.env.ACRCLOUD_ACCESS_SECRET!

  if (!host || !accessKey || !secretKey) {
    return NextResponse.json({ ok: false, error: 'Missing ACRCloud env vars' }, { status: 500 })
  }

  const formData = await request.formData()
  const audioBlob = formData.get('audio') as Blob | null

  if (!audioBlob) {
    return NextResponse.json({ ok: false, error: 'No audio file provided' }, { status: 400 })
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const method = 'POST'
  const uri = '/v1/identify'
  const dataType = 'audio'
  const signatureVersion = '1'

  const signStr = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n')
  const signature = crypto.createHmac('sha1', secretKey).update(signStr).digest('base64')

  const body = new FormData()
  body.append('sample', audioBlob, 'test.webm')
  body.append('access_key', accessKey)
  body.append('data_type', dataType)
  body.append('signature_version', signatureVersion)
  body.append('signature', signature)
  body.append('sample_bytes', audioBlob.size.toString())
  body.append('timestamp', timestamp)

  try {
    const res = await fetch(`https://${host}${uri}`, { method: 'POST', body })
    const json = await res.json()

    return NextResponse.json({
      ok: true,
      http_status: res.status,
      acr_status_code: json.status?.code,
      acr_status_msg: json.status?.msg,
      recognized: json.status?.code === 0,
      result: json.status?.code === 0 ? json.metadata?.music?.[0] : null,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
