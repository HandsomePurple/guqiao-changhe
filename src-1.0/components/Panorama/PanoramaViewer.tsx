import { useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Bridge } from '../../types/bridge'

interface Props {
  bridge: Bridge
  onClose: () => void
}

export default function PanoramaViewer({ bridge, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="modal-overlay-light"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        {/* 渐变背景光 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(211,184,133,0.1) 0%, transparent 55%)',
          }}
        />

        <motion.div
          className="relative w-[90%] max-w-[1200px] aspect-[16/9] rounded-xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            border: '1px solid rgba(211,184,133,0.28)',
            boxShadow: '0 0 40px rgba(211,184,133,0.08), 0 12px 60px rgba(0,0,0,0.08)',
            background: 'rgba(244,239,229,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* 关闭按钮 */}
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>

          {/* 全景占位 */}
          <div className="w-full h-full flex flex-col items-center justify-center">
            {/* 桥名 */}
            <h2
              className="text-4xl font-bold tracking-[8px] mb-4"
              style={{
                fontFamily: "'Noto Serif SC', serif",
                color: '#363129',
                textShadow: '0 0 12px rgba(211,184,133,0.15)',
              }}
            >
              {bridge.name}
            </h2>
            <div className="text-sm mb-2" style={{ color: '#8A7D6E' }}>
              {bridge.province} · {bridge.city}
            </div>

            {/* 占位提示 */}
            <div
              className="text-sm mt-4 px-6 py-3 rounded-lg"
              style={{
                color: '#8A7D6E',
                border: '1px dashed rgba(211,184,133,0.25)',
                background: 'rgba(211,184,133,0.06)',
                fontFamily: "'Noto Serif SC', serif",
                letterSpacing: 2,
              }}
            >
              全景图待添加 · 将支持 360° 浏览
            </div>

            <div className="text-xs mt-6" style={{ color: '#9A9080' }}>
              按 ESC 或点击空白处关闭
            </div>
          </div>

          {/* 底部解锁标记 */}
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm tracking-[4px]"
            style={{
              color: '#A6855C',
              fontFamily: "'Noto Serif SC', serif",
            }}
          >
            ★ 已解锁全景 · {bridge.name}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
