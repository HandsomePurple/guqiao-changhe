import { useEffect, useRef, useState, useCallback } from 'react'
import { PERIOD_CONFIG } from '../../data/bridges'
import WaterRippleGL, { type WaterRippleMouse } from './WaterRippleGL'
import './time-river.css'

interface Props {
  bridges: import('../../types/bridge').Bridge[]
  onClose: () => void
}

const PERIODS = ['sui-tang', 'song-yuan', 'ming-qing', 'modern'] as const

// 时期触发阈值（右侧文字用，不变）
const PERIOD_THRESHOLDS = [0.15, 0.40, 0.65, 0.78]

// 每座桥独立触发
interface BridgeTrigger {
  id: string
  threshold: number
  images: string[]
  label: string
}

const BRIDGE_TRIGGERS: BridgeTrigger[] = [
  { id: 'zhaozhou', threshold: 0.15, images: ['长河桥影-赵州桥.webp'], label: '赵州桥' },
  { id: 'shiqikong', threshold: 0.35, images: ['长河桥影-十七孔桥.webp'], label: '十七孔桥' },
  { id: 'wuting', threshold: 0.52, images: ['长河桥影-五亭桥.webp'], label: '五亭桥' },
  { id: 'wuhan', threshold: 0.68, images: ['长河桥影-武汉长江大桥.webp'], label: '武汉长江大桥' },
  { id: 'gangzhuao', threshold: 0.84, images: ['长河桥影-港珠澳大桥.webp'], label: '港珠澳大桥' },
]

// 标签默认位置（top: 百分比, left: px）
const LABEL_DEFAULTS: Record<string, { top: number; left: number }> = {
  zhaozhou: { top: 11.5, left: 44 },
  shiqikong: { top: 26, left: 89 },
  wuting: { top: 42, left: 205 },
  wuhan: { top: 59, left: 238 },
  gangzhuao: { top: 83, left: 96 },
}

export default function TimeRiver({ onClose }: Props) {
  const [periodTriggered, setPeriodTriggered] = useState([false, false, false, false])
  const [bridgeTriggered, setBridgeTriggered] = useState([false, false, false, false, false])
  const [labelPositions, setLabelPositions] = useState(LABEL_DEFAULTS)
  const [editorOpen, setEditorOpen] = useState(false)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const rippleIdRef = useRef(0)
  const lastRippleRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef<WaterRippleMouse>({ x: 0, y: 0, inside: false })
  const leftRef = useRef<HTMLDivElement>(null)

  // ESC 关闭（编辑器中先关编辑器）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editorOpen) { setEditorOpen(false); return }
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, editorOpen])

  // Cmd+Shift+E 切换位置编辑器
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        setEditorOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 鼠标移动 → 更新坐标 + 触发 + 水波纹PNG涟漪
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = leftRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const leftX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const x = leftX * 0.52

    mouseRef.current = { x, y, inside: true }

    // 水波纹 PNG 涟漪 — 每 180ms 生成一个
    const now = Date.now()
    if (now - lastRippleRef.current > 180) {
      lastRippleRef.current = now
      const cardEl = cardRef.current
      if (cardEl) {
        const cr = cardEl.getBoundingClientRect()
        const rx = e.clientX - cr.left
        const ry = e.clientY - cr.top
        const id = rippleIdRef.current++
        setRipples(prev => [...prev, { id, x: rx, y: ry }])
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== id))
        }, 1800)
      }
    }

    setPeriodTriggered(prev => {
      const next = [...prev]
      let changed = false
      for (let i = 0; i < PERIOD_THRESHOLDS.length; i++) {
        if (y >= PERIOD_THRESHOLDS[i] && !prev[i]) {
          next[i] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
    setBridgeTriggered(prev => {
      const next = [...prev]
      let changed = false
      for (let i = 0; i < BRIDGE_TRIGGERS.length; i++) {
        if (y >= BRIDGE_TRIGGERS[i].threshold && !prev[i]) {
          next[i] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: 0, y: 0, inside: false }
  }, [])

  // 更新单个标签位置
  const updateLabelPos = useCallback((bridgeId: string, key: 'top' | 'left', value: number) => {
    setLabelPositions(prev => ({
      ...prev,
      [bridgeId]: { ...prev[bridgeId], [key]: value },
    }))
  }, [])

  // 复制当前定位到剪贴板
  const copyPositions = useCallback(() => {
    const text = JSON.stringify(labelPositions, null, 2)
    navigator.clipboard.writeText(text).catch(() => {})
  }, [labelPositions])

  return (
    <div className="time-river-overlay" onClick={onClose}>
      {/* 品牌图标 */}
      <div className="tr-brand-capsule-overlay">
        <div className="capsule-icon">桥</div>
        <span className="capsule-text">长河桥影</span>
      </div>

      {/* ═══ 桥标签位置编辑器 ═══ */}
      {editorOpen && (
        <div className="tr-label-editor" onClick={(e) => e.stopPropagation()}>
          <h3>桥名标签定位</h3>
          {BRIDGE_TRIGGERS.map(bt => {
            const pos = labelPositions[bt.id] || { top: bt.threshold * 100, left: 8 }
            return (
              <div key={bt.id} className="editor-bridge-row">
                <span className="editor-bridge-name">{bt.label}</span>
                <div className="editor-controls">
                  <label>
                    top
                    <input
                      type="number"
                      value={pos.top}
                      step={0.5}
                      onChange={(e) => updateLabelPos(bt.id, 'top', parseFloat(e.target.value) || 0)}
                    />
                    %
                  </label>
                  <label>
                    left
                    <input
                      type="number"
                      value={pos.left}
                      step={1}
                      onChange={(e) => updateLabelPos(bt.id, 'left', parseFloat(e.target.value) || 0)}
                    />
                    px
                  </label>
                </div>
              </div>
            )
          })}
          <div className="editor-btn-row">
            <button className="editor-btn" onClick={copyPositions}>复制坐标</button>
          </div>
          <div className="editor-hint">Cmd+Shift+E 关闭编辑器</div>
        </div>
      )}

      <div className="time-river-card" onClick={(e) => e.stopPropagation()}>
        {/* 桥 PNG 叠加层 — 每座桥独立触发 */}
        {BRIDGE_TRIGGERS.map((bt, i) =>
          bt.images.map((img, j) => (
            <img
              key={`${bt.id}-${j}`}
              src={`images/${img}`}
              className={`tr-bridge-img tr-bridge-${bt.id}${j > 0 ? ` tr-bridge-${bt.id}-${j}` : ''}${bridgeTriggered[i] ? ' tr-bridge-visible' : ''}`}
              alt=""
            />
          ))
        )}

        {/* 桥名标签 — 仿首页标记外框，仅竖排桥名 */}
        {BRIDGE_TRIGGERS.map((bt, i) => {
          const pos = labelPositions[bt.id] || { top: bt.threshold * 100, left: 8 }
          return (
            <div
              key={`label-${bt.id}`}
              className={`tr-bridge-label${bridgeTriggered[i] ? ' tr-bridge-visible' : ''}`}
              style={{ top: `${pos.top}%`, left: `${pos.left}px` }}
            >
              <span className="tr-bridge-label-text">{bt.label}</span>
            </div>
          )
        })}

        {/* WebGL 河流层 + 湖面微闪 */}
        <WaterRippleGL mouseRef={mouseRef} />

        {/* 鼠标涟漪 — 水波纹 PNG 从鼠标位置扩散 */}
        <div className="tr-ripple-layer" ref={cardRef}>
          {ripples.map(r => (
            <img
              key={r.id}
              src="images/水波纹.webp"
              className="tr-ripple-dot"
              style={{ left: r.x, top: r.y }}
              alt=""
            />
          ))}
        </div>

        {/* ═══ 左侧：河流交互区 ═══ */}
        <div
          className="time-river-left"
          ref={leftRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* ═══ 右侧：四个时期文字 ═══ */}
        <div className="time-river-right">
          {PERIODS.map((period, i) => {
            const cfg = PERIOD_CONFIG[period]
            const titleKW = cfg.techSummary[0] || ''
            const techText = (cfg.techSummary[1] || '').replace(/^关键技术：/, '')

            return (
              <div
                key={period}
                className={`tr-period-block${periodTriggered[i] ? ' tr-period-visible' : ''}`}
              >
                <div className="tr-period-title">
                  <span className="tr-title-era">{cfg.label}</span>
                  <span className="tr-title-kw">{titleKW}</span>
                </div>
                {techText && (
                  <div className="tr-tech-text">{techText}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
