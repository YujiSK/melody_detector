'use client'

export default function WaveAnimation() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      <style>{`
        @keyframes wave-pulse {
          0%, 100% { height: 12px; opacity: 0.4; }
          50% { height: 48px; opacity: 1; }
        }
        .wave-bar {
          animation: wave-pulse 1.2s ease-in-out infinite;
        }
      `}</style>
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="w-1.5 bg-blue-500 rounded-full wave-bar"
          style={{
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}
