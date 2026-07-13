import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Bridge } from '../../types/bridge'
import { BRIDGE_TYPE_LABELS } from '../../data/bridges'
import BridgeCanvas3D from './BridgeCanvas3D'
import SwipeView from './SwipeView'

interface Props {
  bridge: Bridge
  onClose: () => void
  onOpenPanorama: (bridge: Bridge) => void
  isUnlocked: boolean
}

// ── 过渡阶段枚举 ──
type TransitionPhase = 'idle' | 'shake' | 'dissolving' | 'particle' | 'flashing' | 'emerging'

export default function BridgeModal({ bridge, onClose, onOpenPanorama, isUnlocked }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const isShiqikong = bridge.id === 'shiqikong'

  // ── 十七孔桥 2D↔3D 切换状态 ──
  const [isParticleMode, setIsParticleMode] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── 进入粒子模式 ──
  const enterParticleMode = useCallback(() => {
    if (transitionPhase !== 'idle' || isParticleMode) return
    setTransitionPhase('shake')

    // Shake 0.3s → 溶解 + 挂载粒子模型
    setTimeout(() => {
      setTransitionPhase('dissolving')
      setIsParticleMode(true)
    }, 300)
    // 0.9s 后溶解完成 → idle
    setTimeout(() => {
      setTransitionPhase('idle')
    }, 900)
  }, [transitionPhase, isParticleMode])

  // ── 退出粒子模式，回到静态图 ──
  const revertToStatic = useCallback(() => {
    if (transitionPhase !== 'idle' || !isParticleMode) return
    setTransitionPhase('flashing')

    // 白光闪现 0.2s → 卸载粒子模型 + PNG 弹回
    setTimeout(() => {
      setIsParticleMode(false)
      setTransitionPhase('emerging')
    }, 200)
    // 弹回动画 0.5s → idle
    setTimeout(() => {
      setTransitionPhase('idle')
    }, 700)
  }, [transitionPhase, isParticleMode])

  // ── 桥 PNG 显示逻辑 ──
  const pngClickable = transitionPhase === 'idle' && !isParticleMode
  const pngVisible = !isParticleMode && transitionPhase !== 'flashing'
  const pngInlineOpacity = (transitionPhase === 'dissolving' || transitionPhase === 'emerging')
    ? 1
    : (pngVisible ? 1 : 0)

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="modal-overlay-light"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        {/* 径向渐变背景光 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(244,239,229,0.6) 0%, rgba(225,215,239,0.4) 60%, #E1D7EF 100%)',
          }}
        />

        {/* 内容层 — 固定宽度 1080px，居中显示 */}
        <motion.div
          className="relative flex overflow-hidden"
          style={{
            width: 1080,
            maxHeight: '85vh',
            margin: 'auto',
            background: 'rgba(244,239,229,0.95)',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(211,184,133,0.15)',
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* 关闭按钮 — 右上角 */}
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all hover:bg-white/50"
            style={{
              color: '#8A7D6E',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>

          {/* ──── 左侧：3:4 场景图/模型区域 ──── */}
          <div
            className="relative flex-shrink-0 overflow-hidden"
            style={{
              width: 480,
              height: 640,
              background: '#F0EBE3',
            }}
          >
            <SwipeView
              hasRealImage={!!bridge.realImage}
              realImageUrl={bridge.realImage}
            >
              {/* ═══ 十七孔桥：背景图 + 桥PNG叠层 + 回切热区 ═══ */}
              {isShiqikong && (
                <>
                  {/* Layer 0: 背景底图 — 始终可见 */}
                  <div
                    className="absolute inset-0 z-[1] pointer-events-none"
                    style={{
                      backgroundImage: `url(images/shiqikong-bg.webp)`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />

                  {/* Layer 1: 桥 PNG 图片 — 静态模式可见/可点击 */}
                  <div
                    className={`absolute inset-0 z-[2] bridge-png-layer ${
                      transitionPhase === 'shake' ? 'shaking' : ''
                    } ${
                      transitionPhase === 'dissolving' ? 'dissolving' : ''
                    } ${
                      transitionPhase === 'emerging' ? 'emerging' : ''
                    }`}
                    style={{
                      backgroundImage: `url(images/shiqikong-bridge.webp)`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      opacity: pngInlineOpacity,
                      cursor: pngClickable ? 'pointer' : 'default',
                      pointerEvents: pngClickable ? 'auto' : 'none',
                    }}
                    onClick={pngClickable ? enterParticleMode : undefined}
                    title={pngClickable ? '点击转换为粒子模型' : undefined}
                  />

                  {/* Layer 2: 回切热区 — 粒子模式下可点击桥位区域退回静态图 */}
                  {isParticleMode && transitionPhase === 'idle' && (
                    <div
                      className="absolute inset-0 z-[8] cursor-pointer"
                      onClick={revertToStatic}
                      title="点击退回静态图"
                    />
                  )}

                  {/* Layer 3: 白光闪现层 */}
                  {transitionPhase === 'flashing' && (
                    <div
                      className="absolute inset-0 z-[9] pointer-events-none"
                      style={{
                        background: 'rgba(255,255,255,0.6)',
                        animation: 'bridgeWhiteFlash 0.22s ease-out forwards',
                      }}
                    />
                  )}
                </>
              )}

              {/* 3D 场景 — 十七孔桥静态模式不渲染，粒子模式才挂载；其他桥始终显示 */}
              {(!isShiqikong || isParticleMode) && (
                <BridgeCanvas3D
                  bridge={bridge}
                  isParticleMode={isShiqikong ? isParticleMode : undefined}
                />
              )}
            </SwipeView>
          </div>

          {/* ──── 右侧：文字信息面板 ──── */}
          <div
            className="flex-1 overflow-y-auto p-8"
            style={{
              minWidth: 0,
              background: 'linear-gradient(-90deg, rgba(244,239,229,0.98) 0%, rgba(244,239,229,0.94) 100%)',
            }}
          >
            {/* 桥名 */}
            <h2
              className="text-2xl font-semibold tracking-[6px] mb-1"
              style={{ fontFamily: "'Noto Serif SC', serif", color: '#363129' }}
            >
              {bridge.name}
            </h2>

            {/* 副标题 */}
            <div
              className="text-xs mb-5 pb-4 border-b"
              style={{
                color: '#8A7D6E',
                borderColor: 'rgba(211,184,133,0.18)',
              }}
            >
              {bridge.province} {bridge.city}
            </div>

            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="info-tag">{BRIDGE_TYPE_LABELS[bridge.type]}</span>
              <span className="info-tag">{bridge.era} · {bridge.year}</span>
              <span className="info-tag">{bridge.length}</span>
              <span className="info-tag">{bridge.material}</span>
            </div>

            {/* 描述 */}
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: '#363129', lineHeight: 1.8, textAlign: 'justify' }}
            >
              {bridge.description}
            </p>

            {/* 历史沿革 */}
            <div className="mb-6">
              <h3 className="text-section-title">历史沿革</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4A403A', lineHeight: 1.8 }}>
                {bridge.history}
              </p>
            </div>

            {/* 建筑特点 */}
            {bridge.features.length > 0 && (
              <div className="mb-6">
                <h3 className="text-section-title">建筑特点</h3>
                <ul className="space-y-1.5">
                  {bridge.features.map((f, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: '#5A5048' }}>
                      <span style={{ color: 'var(--gold)' }}>·</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 诗词 */}
            {bridge.poems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-section-title">名桥诗韵</h3>
                {bridge.poems.map((poem, i) => (
                  <div key={i} className="mb-3 p-3 rounded" style={{ background: 'rgba(211,184,133,0.08)' }}>
                    <div className="text-xs mb-1" style={{ color: '#A6855C' }}>
                      《{poem.title}》— {poem.author}
                    </div>
                    {poem.lines.map((line, j) => (
                      <div key={j} className="text-sm leading-relaxed" style={{ color: '#5A5048' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 观赏点 */}
            {bridge.viewingSpots.length > 0 && (
              <div className="mb-6">
                <h3 className="text-section-title">观赏好去处</h3>
                {bridge.viewingSpots.map((spot, i) => (
                  <div key={i} className="mb-2 text-sm">
                    <span style={{ color: 'var(--gold)' }}>· </span>
                    <span style={{ color: '#363129' }}>{spot.name}</span>
                    <span className="ml-1" style={{ color: '#8A7D6E' }}>{spot.desc}</span>
                    {spot.tip && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-xs"
                        style={{ color: 'var(--gold)', background: 'rgba(211,184,133,0.12)' }}>
                        {spot.tip}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 全景打卡按钮 */}
            <button
              onClick={() => onOpenPanorama(bridge)}
              className="w-full mt-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2"
              style={{
                fontFamily: "'Noto Serif SC', serif",
                color: isUnlocked ? '#A6855C' : '#9A9080',
                borderColor: isUnlocked ? 'rgba(196,154,108,0.5)' : 'rgba(211,184,133,0.25)',
                background: isUnlocked ? 'rgba(211,184,133,0.12)' : 'rgba(244,239,229,0.5)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                letterSpacing: 2,
              }}
            >
              {isUnlocked ? '★ 全景已解锁' : '☆ 打卡解锁全景'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
