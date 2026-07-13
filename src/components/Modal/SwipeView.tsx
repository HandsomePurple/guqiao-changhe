import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface SwipeViewProps {
  hasRealImage: boolean
  children: React.ReactNode
  realImageUrl?: string
}

type ViewMode = 'scene' | 'real'

export default function SwipeView({ hasRealImage, children, realImageUrl }: SwipeViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('scene')
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const [dragDelta, setDragDelta] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const threshold = 60

  const handleStart = useCallback((clientX: number) => {
    if (!hasRealImage) return
    setIsDragging(true)
    startXRef.current = clientX
    setDragDelta(0)
  }, [hasRealImage])

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !hasRealImage) return
    const delta = clientX - startXRef.current
    setDragDelta(delta)
  }, [isDragging, hasRealImage])

  const handleEnd = useCallback(() => {
    if (!isDragging || !hasRealImage) return
    setIsDragging(false)

    if (dragDelta < -threshold) {
      setViewMode('real')
    } else if (dragDelta > threshold) {
      setViewMode('scene')
    }
    setDragDelta(0)
  }, [isDragging, hasRealImage, dragDelta])

  if (!hasRealImage) {
    return <div className="relative w-full h-full">{children}</div>
  }

  const translateX = viewMode === 'scene' ? 0 : -100
  const dragPercent = isDragging ? (dragDelta / 480) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'pan-y' }}
    >
      <motion.div
        className="absolute inset-0 flex"
        animate={{ translateX: `${translateX + dragPercent}%` }}
        transition={isDragging ? { type: 'tween', ease: 'linear', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="relative flex-shrink-0 w-full h-full">
          {children}
        </div>

        <div className="relative flex-shrink-0 w-full h-full" style={{ background: '#F0EBE3' }}>
          {realImageUrl && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${realImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12 }}>
            实景图
          </div>
        </div>
      </motion.div>

      {/* 左右边缘手势捕获层 — 不影响中间3D交互 */}
      <div
        className="absolute top-0 left-0 h-full z-[999] cursor-grab active:cursor-grabbing"
        style={{ width: 50 }}
        onMouseDown={(e) => { e.stopPropagation(); handleStart(e.clientX) }}
        onTouchStart={(e) => { e.stopPropagation(); handleStart(e.touches[0].clientX) }}
      />
      <div
        className="absolute top-0 right-0 h-full z-[999] cursor-grab active:cursor-grabbing"
        style={{ width: 50 }}
        onMouseDown={(e) => { e.stopPropagation(); handleStart(e.clientX) }}
        onTouchStart={(e) => { e.stopPropagation(); handleStart(e.touches[0].clientX) }}
      />

      {/* 实景图模式下全层可滑动返回 */}
      {viewMode === 'real' && (
        <div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => { e.stopPropagation(); handleStart(e.clientX) }}
          onTouchStart={(e) => { e.stopPropagation(); handleStart(e.touches[0].clientX) }}
        />
      )}

      {/* 全局 mouse/touch 监听（拖拽中） */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50"
          style={{ cursor: 'grabbing', userSelect: 'none' }}
          onMouseMove={(e) => handleMove(e.clientX)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchMove={(e) => handleMove(e.touches[0].clientX)}
          onTouchEnd={handleEnd}
        />
      )}

      {/* 底部指示器 */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-30 pointer-events-none">
        <div className={`w-2 h-2 rounded-full transition-all ${viewMode === 'scene' ? 'bg-[#D3B885] w-6' : 'bg-white/60'}`} />
        <div className={`w-2 h-2 rounded-full transition-all ${viewMode === 'real' ? 'bg-[#D3B885] w-6' : 'bg-white/60'}`} />
      </div>

      {/* 场景图模式 — 右侧滑动提示 */}
      {viewMode === 'scene' && (
        <motion.div
          className="absolute right-3 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <div className="w-5 h-5 border-t-2 border-r-2 border-[#D3B885] rotate-45" style={{ opacity: 0.7 }} />
          <span className="text-xs text-[#D3B885] whitespace-nowrap" style={{ opacity: 0.7 }}>← 左滑看实景</span>
        </motion.div>
      )}

      {/* 实景图模式 — 左侧滑动提示 */}
      {viewMode === 'real' && (
        <motion.div
          className="absolute left-3 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="text-xs text-[#D3B885] whitespace-nowrap" style={{ opacity: 0.7 }}>右滑返回场景 →</span>
          <div className="w-5 h-5 border-t-2 border-r-2 border-[#D3B885] rotate-45 transform rotate-180" style={{ opacity: 0.7 }} />
        </motion.div>
      )}
    </div>
  )
}