import crypto from 'crypto'

const BASE_URL = 'https://identify-ap-southeast-1.acrcloud.com'

function buildSignature(method: string, uri: string, accessKey: string, dataType: string, signatureVersion: string, timestamp: string, secretKey: string): string {
  const signStr = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n')
  return crypto.createHmac('sha1', secretKey).update(signStr).digest('base64')
}

export interface ACRResult {
  status: { msg: string; code: number }
  metadata?: {
    music?: Array<{
      external_ids?: { isrc?: string }
      title: string
      artists?: Array<{ name: string }>
      acrid: string
    }>
  }
}

export async function recognizeAudio(audioBlob: Blob): Promise<ACRResult> {
  const accessKey = process.env.ACR_ACCESS_KEY!
  const secretKey = process.env.ACR_SECRET_KEY!
  const host = process.env.ACR_HOST || BASE_URL

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const method = 'POST'
  const uri = '/v1/identify'
  const dataType = 'audio'
  const signatureVersion = '1'

  const signature = buildSignature(method, uri, accessKey, dataType, signatureVersion, timestamp, secretKey)

  const formData = new FormData()
  formData.append('sample', audioBlob, 'audio.wav')
  formData.append('access_key', accessKey)
  formData.append('data_type', dataType)
  formData.append('signature_version', signatureVersion)
  formData.append('signature', signature)
  formData.append('sample_bytes', audioBlob.size.toString())
  formData.append('timestamp', timestamp)

  const res = await fetch(`${host}${uri}`, {
    method: 'POST',
    body: formData,
  })

  return res.json()
}
