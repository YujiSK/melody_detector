'use client'

import { useEffect, useState } from 'react'

type Meta = {
  appVersion: string
  buildCommit: string
}

export default function PwaRecoveryPanel() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch('/api/meta', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`meta request failed: ${res.status}`)
        return res.json() as Promise<Meta>
      })
      .then(setMeta)
      .catch((err) => {
        setStatus(`Meta fetch failed: ${String(err)}`)
      })
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const fetchTargetUrl = origin ? `${origin}/api/recognize` : 'loading...'

  async function unregisterServiceWorkers() {
    setStatus('Unregistering service workers...')
    if (!('serviceWorker' in navigator)) {
      setStatus('Service Worker is not supported in this browser.')
      return
    }

    const registrations = await navigator.serviceWorker.getRegistrations()
    const results = await Promise.all(registrations.map((registration) => registration.unregister()))
    setStatus(`Service workers unregistered: ${results.filter(Boolean).length}/${registrations.length}`)
  }

  async function clearCaches() {
    setStatus('Clearing Cache Storage...')
    if (!('caches' in window)) {
      setStatus('Cache Storage is not supported in this browser.')
      return
    }

    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    setStatus(`Cache cleared: ${keys.length} caches removed`)
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">PWA / Recovery</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">Service worker control</span>
      </div>

      <div className="space-y-2 text-xs leading-relaxed text-slate-300">
        <p><span className="text-slate-400">App version:</span> {meta?.appVersion ?? 'loading...'}</p>
        <p><span className="text-slate-400">Build commit:</span> <span className="font-mono break-all">{meta?.buildCommit ?? 'loading...'}</span></p>
        <p><span className="text-slate-400">location.origin:</span> <span suppressHydrationWarning className="font-mono break-all">{origin || 'loading...'}</span></p>
        <p><span className="text-slate-400">fetch target URL:</span> <span suppressHydrationWarning className="font-mono break-all">{fetchTargetUrl}</span></p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={unregisterServiceWorkers}
          className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-500"
        >
          Service Worker解除
        </button>
        <button
          type="button"
          onClick={clearCaches}
          className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-500"
        >
          キャッシュクリア
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-300">
        <p className="font-medium text-slate-200">Recovery guide</p>
        <p>Open Chrome DevTools and go to Application &gt; Service Workers. Unregister the old service worker there.</p>
        <p>Then open Application &gt; Storage and use Clear site data to remove old JS bundles and Cache Storage.</p>
      </div>

      {status && (
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400">{status}</pre>
      )}
    </section>
  )
}
