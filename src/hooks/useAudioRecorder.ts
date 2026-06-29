'use client'

import { useState, useRef, useCallback } from 'react'

type RecordState = 'idle' | 'recording' | 'processing'

export function useAudioRecorder() {
  const [state, setState] = useState<RecordState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async (durationMs = 6000) => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      let selectedMime = ''
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime
          break
        }
      }
      const options = selectedMime ? { mimeType: selectedMime } : undefined
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start()
      setState('recording')

      return new Promise<Blob>((resolve, reject) => {
        setTimeout(() => {
          mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop())
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            setState('processing')
            resolve(blob)
          }
          mediaRecorder.stop()
        }, durationMs)

        mediaRecorder.onerror = () => {
          stream.getTracks().forEach(t => t.stop())
          setState('idle')
          reject(new Error('Recording failed'))
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
      setState('idle')
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  return { state, error, start, reset }
}
