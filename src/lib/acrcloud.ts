import crypto from 'crypto'

export interface ACRResult {
  status: { msg: string; code: number; version?: string }
  metadata?: {
    music?: Array<{
      external_ids?: { isrc?: string }
      title: string
      artists?: Array<{ name: string }>
      acrid: string
    }>
  }
}

export async function recognizeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debugInfo: any
): Promise<ACRResult> {
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY!
  const secretKey = process.env.ACRCLOUD_ACCESS_SECRET!
  const host = process.env.ACRCLOUD_HOST || 'identify-ap-southeast-1.acrcloud.com'

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const method = 'POST'
  const uri = '/v1/identify'
  const dataType = 'audio'
  const signatureVersion = '1'

  const signStr = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n')
  const signature = crypto.createHmac('sha1', secretKey).update(signStr).digest('base64')

  const requestUrl = `https://${host}${uri}`

  // Write debug details (omitting the raw secret key for security)
  debugInfo.timestamp = timestamp
  debugInfo.string_to_sign = signStr
  debugInfo.request_url = requestUrl

  const formData = new FormData()
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType })
  formData.append('sample', audioBlob, 'sample.webm')
  formData.append('access_key', accessKey)
  formData.append('data_type', dataType)
  formData.append('signature_version', signatureVersion)
  formData.append('signature', signature)
  formData.append('sample_bytes', audioBuffer.byteLength.toString())
  formData.append('timestamp', timestamp)

  const res = await fetch(requestUrl, {
    method: 'POST',
    body: formData,
  })

  debugInfo.http_status = res.status
  const resText = await res.text()
  debugInfo.response_text = resText

  try {
    const rawJson = JSON.parse(resText)
    return rawJson as ACRResult
  } catch {
    throw new Error(`Failed to parse ACRCloud response JSON (HTTP ${res.status}): ${resText}`)
  }
}
