import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Bridge } from '../../types/bridge'
import { BRIDGE_TYPE_LABELS } from '../../data/bridges'
import BridgeCanvas3D from './BridgeCanvas3D'

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
      setIsParticleMode(true)  // 粒子模型在溶解阶段就挂载，避免空白
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
      setIsParticleMode(false)  // 卸载 BridgeCanvas3D
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
  // 溶解/弹回阶段 CSS keyframe 接管 opacity，inline 保持 1 避免干扰
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

        {/* 暗化品牌图标 — 卡片上方 */}
        <div className="modal-brand-capsule">
          <div className="capsule-icon">桥</div>
          <span className="capsule-text">长河桥影</span>
        </div>

        {/* 内容层 */}
        <motion.div
          className="relative w-full h-full overflow-hidden"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* 关闭按钮 */}
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>

          {/* ═══ 十七孔桥：背景图 + 桥PNG叠层 + 回切热区 ═══ */}
          {isShiqikong && (
            <>
              {/* Layer 0: 背景底图 — 始终可见 */}
              <div
                className="absolute top-0 bottom-0 z-[1] pointer-events-none"
                style={{
                  left: 0,
                  right: 340,
                  backgroundImage: `url(images/shiqikong-bg.webp)`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />

              {/* Layer 1: 桥 PNG 图片 — 静态模式可见/可点击 */}
              <div
                className={`absolute top-0 bottom-0 z-[2] bridge-png-layer ${
                  transitionPhase === 'shake' ? 'shaking' : ''
                } ${
                  transitionPhase === 'dissolving' ? 'dissolving' : ''
                } ${
                  transitionPhase === 'emerging' ? 'emerging' : ''
                }`}
                style={{
                  left: 0,
                  right: 340,
                  backgroundImage: `url(images/shiqikong-bridge.webp)`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: pngInlineOpacity,
                  cursor: pngClickable ? 'pointer' : 'default',
                  pointerEvents: pngClickable ? 'auto' : 'none',
                  /* 调试边框 — 确认层存在，确认后移除 */
                  outline: '2px dashed rgba(201,168,130,0.5)',
                  outlineOffset: '-4px',
                }}
                onClick={pngClickable ? enterParticleMode : undefined}
                title={pngClickable ? '点击转换为粒子模型' : undefined}
              />

              {/* Layer 2: 回切热区 — 粒子模式下可点击桥位区域退回静态图 */}
              {isParticleMode && transitionPhase === 'idle' && (
                <div
                  className="absolute top-0 bottom-0 z-[8] cursor-pointer"
                  style={{ left: 0, right: 340 }}
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

          {/* 3D 场景 — 十七孔桥静态模式不渲染（避免 z-index 遮挡桥PNG），粒子模式才挂载；其他桥始终显示 */}
          {(!isShiqikong || isParticleMode) && (
            <BridgeCanvas3D
              bridge={bridge}
              isParticleMode={isShiqikong ? isParticleMode : undefined}
            />
          )}

          {/* 右侧信息面板 — 花间集暖米毛玻璃 */}
          <div
            className="absolute top-0 right-0 bottom-0 overflow-y-auto z-10 p-8 border-l"
            style={{
              width: 340,
              background: 'linear-gradient(-90deg, rgba(244,239,229,0.94) 0%, rgba(244,239,229,0.7) 100%)',
              borderColor: 'rgba(211,184,133,0.18)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
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

          {/* 角落祥云装饰 */}
          <div className="absolute top-0 left-0 w-32 h-32 opacity-4 pointer-events-none">
            <svg viewBox="0 0 100 100" fill="currentColor" style={{ color: '#D3B885', opacity: 0.06 }}>
              <path d="M50 10 C20 10 10 30 10 50 C10 70 30 90 50 90 C70 90 90 70 90 50 C90 30 70 10 50 10 M30 30 C35 30 40 35 40 40 C40 45 35 50 30 50 C25 50 20 45 20 40 C20 35 25 30 30 30" />
            </svg>
          </div>
          <div className="absolute bottom-0 right-0 w-32 h-32 opacity-4 pointer-events-none rotate-180">
            <svg viewBox="0 0 100 100" fill="currentColor" style={{ color: '#D3B885', opacity: 0.06 }}>
              <path d="M50 10 C20 10 10 30 10 50 C10 70 30 90 50 90 C70 90 90 70 90 50 C90 30 70 10 50 10 M30 30 C35 30 40 35 40 40 C40 45 35 50 30 50 C25 50 20 45 20 40 C20 35 25 30 30 30" />
            </svg>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
