import crypto from 'crypto'

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

  const formData = new FormData()
  formData.append('sample', audioBlob, 'audio.webm')
  formData.append('access_key', accessKey)
  formData.append('data_type', dataType)
  formData.append('signature_version', signatureVersion)
  formData.append('signature', signature)
  formData.append('sample_bytes', audioBlob.size.toString())
  formData.append('timestamp', timestamp)

  const res = await fetch(`https://${host}${uri}`, {
    method: 'POST',
    body: formData,
  })

  return res.json()
}
