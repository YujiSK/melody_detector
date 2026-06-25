import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegister from './sw-register'

const noto = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '賛美カナルビ',
  description: '韓国賛美のカナルビ表示システム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '賛美カナルビ',
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className={`${noto.className} bg-gray-950 text-white min-h-screen`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
