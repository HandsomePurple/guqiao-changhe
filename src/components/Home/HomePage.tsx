import { useState, useMemo, useCallback, useRef } from 'react'
import type { Bridge } from '../../types/bridge'
import { BRIDGE_TYPE_LABELS, BRIDGE_CATEGORY_COLORS } from '../../data/bridges'
import BridgeMap from './BridgeMap'
import { latLngToWorldPos, SOUTH_SHIFT } from './Terrain3D'
import * as THREE from 'three'
import AmbientSpots from './AmbientSpots'

/** 🎯 桥专属相机角度配置 — 用校准面板复制后粘贴到这里 */
interface BridgeCamEntry {
  camPos: [number, number, number]
  camTarget: [number, number, number]
}
const BRIDGE_CAM_CONFIGS: Record<string, BridgeCamEntry> = {
  'luoyang-bridge': { camPos: [0.88, 3.65, 8.22], camTarget: [1.12, -1.81, 1.95] },
  anping: { camPos: [0.88, 3.65, 8.22], camTarget: [1.12, -1.81, 1.95] },
  'chengyang-yongji': { camPos: [-0.34, 4.00, 7.87], camTarget: [-0.10, -1.47, 1.60] },
  luding: { camPos: [-1.75, 4.19, 7.65], camTarget: [-1.50, -1.27, 1.38] },
}
import BridgeCanvas3D from '../Modal/BridgeCanvas3D'
import ShiqikongBridge3D from '../Modal/ShiqikongBridge3D'
import WutingqiaoBridge3D from '../Modal/WutingqiaoBridge3D'
import ChengyangYongjiBridge3D from '../Modal/ChengyangYongjiBridge3D'
import TimeRiver from './TimeRiver'

/** 把文本中的数字渲染为金色大字高亮 */
function renderContentWithNumbers(content: string) {
  const parts = content.split(/(\d+)/)
  return parts.map((part, i) =>
    /\d+/.test(part) ? (
      <span key={i} className="num-highlight">{part}</span>
    ) : (
      part
    )
  )
}

function renderContentWithAnimation(content: string) {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\d+)/)
    return (
      <div
        key={lineIdx}
        className="bridge-poster-detail-line"
        style={{ animationDelay: `${lineIdx * 0.12}s` }}
      >
        {parts.map((part, partIdx) =>
          /\d+/.test(part) ? (
            <span key={partIdx} className="num-highlight">{part}</span>
          ) : (
            part
          )
        )}
      </div>
    )
  })
}

interface Props {
  bridges: Bridge[]
  selectedBridge: Bridge | null
  unlockedPanoramas: Set<string>
  onSelectBridge: (bridge: Bridge | null) => void
  onOpenPanorama?: (bridge: Bridge) => void
}

export default function HomePage({ bridges, selectedBridge, unlockedPanoramas, onSelectBridge, onOpenPanorama }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const [focusBridgeId, setFocusBridgeId] = useState<string | null>(null) // 仅驱动镜头，不过滤
  const [viewMode, setViewMode] = useState<'global' | 'local'>('global')
  const [panelClosing, setPanelClosing] = useState(false)
  const [selectedKeywordIdx, setSelectedKeywordIdx] = useState<number | null>(null)
  const shiqikongActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; isFlashlightOn: boolean; currentMode: string } | null>(null)
  const wutingqiaoActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; isFlashlightOn: boolean; currentMode: string } | null>(null)
  const chengyangActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; isFlashlightOn: boolean; currentMode: string } | null>(null)
  const [, setForceUpdate] = useState(0) // 强制刷新以获取最新 ref 值
  const [showTimeRiver, setShowTimeRiver] = useState(false)
  const [categoryCamRaw, setCategoryCamRaw] = useState<{ pos: [number, number, number]; target: [number, number, number] } | null>(null)
  const [categoryCalibrate, setCategoryCalibrate] = useState(false)
  const [categoryCamInfo, setCategoryCamInfo] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  
  // 桥梁图鉴列表状态
  const [collectionSearch, setCollectionSearch] = useState('')
  const [collectionFilterType, setCollectionFilterType] = useState<string | null>(null)
  const [posterLoading, setPosterLoading] = useState(false)
  const [loadedModelIds, setLoadedModelIds] = useState<Set<string>>(new Set())
  const [loadProgress, setLoadProgress] = useState(0)

  const isShiqikong = selectedBridge?.id === 'shiqikong'
  const isWutingqiao = selectedBridge?.id === 'wuting'
  const isChengyangYongji = selectedBridge?.id === 'chengyang-yongji'
  const isSpecialBridge = isShiqikong || isWutingqiao || isChengyangYongji
  const activeActionsRef = isShiqikong ? shiqikongActionsRef : isWutingqiao ? wutingqiaoActionsRef : chengyangActionsRef

  const filteredBridges = useMemo(() => {
    let list = bridges
    // 类型筛选
    if (filterType) {
      list = list.filter(b => b.type === filterType)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      list = list.filter(b =>
        b.name.includes(term) || b.city.includes(term) || b.province.includes(term)
      )
    }
    return list
  }, [bridges, filterType, searchTerm])

  const types = useMemo(() => [...new Set(bridges.map(b => b.type))], [bridges])

  // 「分类」模式下按类型计数 + 颜色映射
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    bridges.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1 })
    return counts
  }, [bridges])
  const categoryColorsMap = useMemo(() => {
    if (!showCategoryPanel) return null
    const map: Record<string, string> = {}
    for (const [type, { color }] of Object.entries(BRIDGE_CATEGORY_COLORS)) {
      map[type] = color
    }
    return map
  }, [showCategoryPanel])

  // 镜头聚焦（基于 focusBridgeId，不做筛选）
  const focusTarget = useMemo(() => {
    if (!focusBridgeId) return null
    const bridge = bridges.find(b => b.id === focusBridgeId)
    if (!bridge) return null
    return latLngToWorldPos(bridge.lat, bridge.lng, SOUTH_SHIFT)
  }, [focusBridgeId, bridges])

  const camOverride = useMemo(() => {
    if (!focusBridgeId) return null
    const cfg = BRIDGE_CAM_CONFIGS[focusBridgeId]
    if (!cfg) return null
    return {
      pos: new THREE.Vector3(cfg.camPos[0], cfg.camPos[1], cfg.camPos[2]),
      target: new THREE.Vector3(cfg.camTarget[0], cfg.camTarget[1], cfg.camTarget[2]),
    }
  }, [focusBridgeId])

  // 分类模式专用相机（优先 bridge 聚焦）
  const resolvedCamOverride = useMemo(() => {
    if (camOverride) return camOverride
    if (!showCategoryPanel || !categoryCamRaw) return null
    return {
      pos: new THREE.Vector3(categoryCamRaw.pos[0], categoryCamRaw.pos[1], categoryCamRaw.pos[2]),
      target: new THREE.Vector3(categoryCamRaw.target[0], categoryCamRaw.target[1], categoryCamRaw.target[2]),
    }
  }, [camOverride, showCategoryPanel, categoryCamRaw])

  // 桥梁图鉴筛选和分组
  const collectionBridges = useMemo(() => {
    let list = bridges
    if (collectionFilterType) {
      list = list.filter(b => b.type === collectionFilterType)
    }
    if (collectionSearch.trim()) {
      const term = collectionSearch.trim().toLowerCase()
      list = list.filter(b =>
        b.name.includes(term) || b.city.includes(term) || b.province.includes(term)
      )
    }
    
    const famousIds = new Set(['zhaozhou', 'lugou', 'chengyang-yongji', 'luding', 'guangji', 'luoyang-bridge', 'anping', 'wuting', 'shiqikong'])
    const modernIds = new Set(['gangzhu-ao', 'wuhan-changjiang', 'beipanjiang', 'dankun', 'chaotianmen', 'sutong', 'hangzhouwan', 'aizhai', 'nanjing-changjiang'])
    
    const grouped = {
      famous: list.filter(b => famousIds.has(b.id)),
      modern: list.filter(b => modernIds.has(b.id)),
      other: list.filter(b => !famousIds.has(b.id) && !modernIds.has(b.id)),
    }
    
    return grouped
  }, [bridges, collectionFilterType, collectionSearch])

  const handleCategoryCamChange = useCallback((pos: THREE.Vector3, target: THREE.Vector3) => {
    setCategoryCamInfo({ pos: pos.clone(), target: target.clone() })
  }, [])

  // 关闭面板 — 带退出动画
  const handleClosePanel = useCallback(() => {
    setPanelClosing(true)
    setSelectedKeywordIdx(null)
    setTimeout(() => {
      setPanelClosing(false)
      onSelectBridge(null)
    }, 250)
  }, [onSelectBridge])

  // 模型加载完成回调
  const handleModelLoaded = useCallback((bridgeId: string) => {
    setLoadedModelIds(prev => {
      const next = new Set(prev)
      next.add(bridgeId)
      return next
    })
    setPosterLoading(false)
    setLoadProgress(100)
  }, [])

  // 模型加载进度回调
  const handleModelProgress = useCallback((progress: number) => {
    setLoadProgress(progress)
  }, [])

  // 点击地图标记
  const handleSelectBridge = useCallback((bridge: Bridge) => {
    setPanelClosing(false)
    setSelectedKeywordIdx(null)
    const isSpecial = bridge.id === 'shiqikong' || bridge.id === 'wuting' || bridge.id === 'chengyang-yongji'
    const needsLoading = isSpecial && !loadedModelIds.has(bridge.id)
    if (needsLoading) {
      setPosterLoading(true)
      setLoadProgress(0)
    } else {
      setPosterLoading(false)
    }
    onSelectBridge(bridge)
  }, [onSelectBridge, loadedModelIds])

  return (
    <div className="w-full h-full relative" style={{ background: '#E1D7EF' }}>
      {/* 品牌标题胶囊 — 花间集暖色风格，卡片展开时变深色 */}
      <div
        className={`bridge-brand-capsule${selectedBridge ? ' dark' : ''}`}
        style={{ cursor: 'pointer', pointerEvents: 'auto' } as React.CSSProperties}
        onClick={() => !selectedBridge && setShowTimeRiver(true)}
      >
        <div className="capsule-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 14 Q12 0 21 14" />
            <path d="M3 17 Q7 16 11 17 Q15 18 19 17 Q21 16.5 22 17" strokeWidth="1.2" />
          </svg>
        </div>
        <span className="capsule-text">长河桥影</span>
      </div>

      {/* 环境浮动光斑粒子 */}
      <AmbientSpots />

      {/* 全屏地图 */}
      <div className="flex-1 absolute inset-0 z-0">
        <BridgeMap
          bridges={filteredBridges}
          selectedBridge={selectedBridge}
          viewMode={viewMode}
          focusTarget={focusTarget}
          camOverride={resolvedCamOverride}
          filterBridgeId={focusBridgeId}
          categoryColors={categoryColorsMap}
          onSelectBridge={handleSelectBridge}
          onCamChange={handleCategoryCamChange}
        />
      </div>

      {/* ═══ 桥梁图鉴列表 — 右侧固定 ═══ */}
      <div className={`bridge-collection-panel${selectedBridge ? ' dimmed' : ''}`}>
        <div className="bridge-collection-header">
          <div className="bridge-collection-title">桥梁图鉴</div>
          <div className="bridge-collection-search">
            <input
              type="text"
              placeholder="搜索城市或桥名..."
              value={collectionSearch}
              onChange={e => setCollectionSearch(e.target.value)}
            />
          </div>
          <div className="bridge-collection-filter">
            <button
              className={`bridge-collection-filter-btn${!collectionFilterType ? ' active' : ''}`}
              onClick={() => setCollectionFilterType(null)}
            >
              全部
            </button>
            {types.map(t => (
              <button
                key={t}
                className={`bridge-collection-filter-btn${collectionFilterType === t ? ' active' : ''}`}
                onClick={() => setCollectionFilterType(collectionFilterType === t ? null : t)}
              >
                {BRIDGE_TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bridge-collection-progress">
          <div className="bridge-collection-progress-text">
            已解锁 {selectedBridge ? 1 : 0} / {bridges.length}
          </div>
          <div className="bridge-collection-progress-bar">
            <div
              className="bridge-collection-progress-fill"
              style={{ width: `${(selectedBridge ? 1 : 0) / bridges.length * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bridge-collection-list">
          {collectionBridges.famous.length > 0 && (
            <>
              <div className="bridge-collection-group-title">名桥经典</div>
              {collectionBridges.famous.map(bridge => (
                <div
                  key={bridge.id}
                  className={`bridge-collection-item${selectedBridge?.id === bridge.id ? ' selected' : ''}`}
                  onClick={() => handleSelectBridge(bridge)}
                >
                  <div className="bridge-collection-item-icon">{(BRIDGE_TYPE_LABELS[bridge.type] || bridge.type)[0]}</div>
                  <div className="bridge-collection-item-name">{bridge.name}</div>
                  <div className="bridge-collection-item-city">{bridge.city}</div>
                </div>
              ))}
            </>
          )}
          
          {collectionBridges.modern.length > 0 && (
            <>
              <div className="bridge-collection-group-title">现代奇迹</div>
              {collectionBridges.modern.map(bridge => (
                <div
                  key={bridge.id}
                  className={`bridge-collection-item${selectedBridge?.id === bridge.id ? ' selected' : ''}`}
                  onClick={() => handleSelectBridge(bridge)}
                >
                  <div className="bridge-collection-item-icon">{(BRIDGE_TYPE_LABELS[bridge.type] || bridge.type)[0]}</div>
                  <div className="bridge-collection-item-name">{bridge.name}</div>
                  <div className="bridge-collection-item-city">{bridge.city}</div>
                </div>
              ))}
            </>
          )}
          
          {collectionBridges.other.length > 0 && (
            <>
              <div className="bridge-collection-group-title">古韵悠长</div>
              {collectionBridges.other.map(bridge => (
                <div
                  key={bridge.id}
                  className={`bridge-collection-item${selectedBridge?.id === bridge.id ? ' selected' : ''}`}
                  onClick={() => handleSelectBridge(bridge)}
                >
                  <div className="bridge-collection-item-icon">{(BRIDGE_TYPE_LABELS[bridge.type] || bridge.type)[0]}</div>
                  <div className="bridge-collection-item-name">{bridge.name}</div>
                  <div className="bridge-collection-item-city">{bridge.city}</div>
                </div>
              ))}
            </>
          )}
          
          {!collectionBridges.famous.length && !collectionBridges.modern.length && !collectionBridges.other.length && (
            <div className="bridge-collection-empty">未找到匹配的桥梁</div>
          )}
        </div>
      </div>

      {/* 桥型筛选栏 — 底部居中精致胶囊，双排 */}
      <div
        className="absolute bottom-6 z-[100] flex justify-center pointer-events-none"
        style={{ left: 0, right: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
          {showTypeFilter ? (
            <>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setViewMode('global'); setFilterType(null); setFocusBridgeId(null) }}
                  className={`bridge-bottom-filter-btn${viewMode === 'global' ? ' active' : ''}`}
                >
                  −
                </button>
                <button
                  onClick={() => { setViewMode('local'); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${viewMode === 'local' ? ' active' : ''}`}
                >
                  +
                </button>
                <button
                  onClick={() => { setFilterType(null); setShowTypeFilter(false) }}
                  className={`bridge-bottom-filter-btn${!filterType ? ' active' : ''}`}
                >
                  全部
                </button>
                {types.map(t => {
                  const isActive = t === filterType
                  return (
                    <button
                      key={t}
                      onClick={() => setFilterType(isActive ? null : t)}
                      className={`bridge-bottom-filter-btn${isActive ? ' active' : ''}`}
                    >
                      {BRIDGE_TYPE_LABELS[t] || t}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setFilterType(null); setShowTypeFilter(false) }}
                  className="bridge-bottom-filter-btn active"
                >
                  分类
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => { setViewMode('global'); setFocusBridgeId(null); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${viewMode === 'global' ? ' active' : ''}`}
                >
                  −
                </button>
                <button
                  onClick={() => { setViewMode('local'); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${viewMode === 'local' ? ' active' : ''}`}
                >
                  +
                </button>
                <button
                  onClick={() => { setFocusBridgeId(null); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${!focusBridgeId && !filterType && viewMode === 'global' ? ' active' : ''}`}
                >
                  全部
                </button>
                <button
                  onClick={() => { setFocusBridgeId('luoyang-bridge'); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${focusBridgeId === 'luoyang-bridge' ? ' active' : ''}`}
                >
                  东部
                </button>
                <button
                  onClick={() => { setFocusBridgeId('chengyang-yongji'); setFilterType(null) }}
                  className={`bridge-bottom-filter-btn${focusBridgeId === 'chengyang-yongji' ? ' active' : ''}`}
                >
                  南部
                </button>
                {filterType && null}
                <button
                  onClick={() => { setShowCategoryPanel(v => !v); setShowTypeFilter(false) }}
                  className={`bridge-bottom-filter-btn${showCategoryPanel ? ' active' : ''}`}
                  style={{ marginLeft: filterType ? 2 : 4 }}
                >
                  分类
                </button>
                <button
                  onClick={() => setShowTimeRiver(true)}
                  className="bridge-bottom-filter-btn"
                >
                  长河桥影
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ 分类面板 — 底部工具栏上方两行横排，半透明 ═══ */}
      {showCategoryPanel && (
        <div
          style={{
            position: 'fixed',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'rgba(245,240,228,0.68)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(180,155,125,0.32)',
            borderRadius: 12,
            padding: '10px 20px',
            maxWidth: '90vw',
            boxShadow: '0 3px 18px rgba(140,115,90,0.08), 0 0 10px rgba(180,150,120,0.03)',
            animation: 'categorySlideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
            pointerEvents: 'auto',
          }}
        >
          {/* 分类列表 — 5列 × 2行网格，按数量从高到低排序 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto)', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
            {Object.entries(BRIDGE_CATEGORY_COLORS)
              .sort(([, { label: a }], [, { label: b }]) => {
                const typeA = Object.keys(BRIDGE_CATEGORY_COLORS).find(k => BRIDGE_CATEGORY_COLORS[k].label === a) || ''
                const typeB = Object.keys(BRIDGE_CATEGORY_COLORS).find(k => BRIDGE_CATEGORY_COLORS[k].label === b) || ''
                return (categoryCounts[typeB] || 0) - (categoryCounts[typeA] || 0)
              })
              .map(([type, { label, color }]) => {
              const count = categoryCounts[type] || 0
              const isFiltered = filterType === type
              return (
                <div
                  key={type}
                  onClick={() => { setFilterType(isFiltered ? null : type); setFocusBridgeId(null) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    background: isFiltered ? 'rgba(180,155,125,0.20)' : 'transparent',
                    border: isFiltered ? '1px solid rgba(180,155,125,0.28)' : '1px solid transparent',
                    transition: 'all 0.22s ease',
                  }}
                  onMouseEnter={e => { if (!isFiltered) (e.currentTarget as HTMLElement).style.background = 'rgba(180,155,125,0.08)' }}
                  onMouseLeave={e => { if (!isFiltered) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* 色圆点 */}
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }} />
                  {/* 名称 */}
                  <span style={{
                    fontFamily: "'汇文明朝体', serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: isFiltered ? '#6B5040' : '#8B7B6E',
                    letterSpacing: 1.5,
                    whiteSpace: 'nowrap',
                    transition: 'color 0.22s ease',
                  }}>
                    {label}
                  </span>
                  {/* 数量 */}
                  <span style={{
                    fontFamily: "'SF Mono', Menlo, monospace",
                    fontSize: 10,
                    fontWeight: 400,
                    color: isFiltered ? '#6B5040' : '#A09080',
                    letterSpacing: 0.5,
                  }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 海报浮层 */}
      {selectedBridge && (
        <>
          {/* 暗化遮罩 — 点击关闭 */}
          {!panelClosing && (
            <div className="bridge-poster-overlay" onClick={handleClosePanel} />
          )}

          <div className={`bridge-poster-wrapper${panelClosing ? ' closing' : ''}`}>

            {/* ═══ 卡片本体 — 底图 + 3D 粒子模型 + 关键词 + 文字 ═══ */}
            <div
              className="bridge-poster-card"
              onClick={(e) => {
                e.stopPropagation()
                if (!isSpecialBridge) handleClosePanel()
              }}
            >
              {/* 关闭按钮 — 右上角 */}
              <button
                className="bridge-poster-close"
                onClick={(e) => { e.stopPropagation(); handleClosePanel() }}
                aria-label="关闭"
              >
                ✕
              </button>

              {/* ── 左侧：3:4 场景图/模型区 ── */}
              <div className="bridge-poster-left">
                {posterLoading && (
                  <div className="bridge-poster-loading">
                    <div className="bridge-poster-loading-content">
                      <div className="bridge-poster-loading-text">桥影渐显 · 请稍候</div>
                      <div className="bridge-poster-loading-progress">
                        <div
                          className="bridge-poster-loading-progress-bar"
                          style={{ width: `${loadProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {/* 卡片顶部信息区 — 桥名+位置+类型+年代，pointer-events:none 不拦截交互 */}
                <div
                  className="bridge-poster-top-info"
                  style={isWutingqiao ? {
                    textAlign: 'right',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)',
                  } as React.CSSProperties : undefined}
                >
                  <div className="bridge-poster-top-name">{selectedBridge.name}</div>
                  <div className="bridge-poster-top-meta" style={isWutingqiao ? { justifyContent: 'flex-end' } as React.CSSProperties : undefined}>
                    <span>{selectedBridge.province} · {selectedBridge.city}</span>
                    <span className="bridge-poster-top-meta-divider" />
                    <span>{BRIDGE_TYPE_LABELS[selectedBridge.type] || selectedBridge.type}</span>
                    <span className="bridge-poster-top-meta-divider" />
                    <span>{selectedBridge.era}</span>
                  </div>
                </div>

                {/* ── 十七孔桥/五亭桥/程阳永济桥：新三态交互系统 ── */}
                {isSpecialBridge ? (
                  isShiqikong ? (
                    <ShiqikongBridge3D bridge={selectedBridge} onClose={handleClosePanel} actionsRef={shiqikongActionsRef} onLoad={() => handleModelLoaded(selectedBridge.id)} onProgress={handleModelProgress} />
                  ) : isWutingqiao ? (
                    <WutingqiaoBridge3D bridge={selectedBridge} onClose={handleClosePanel} actionsRef={wutingqiaoActionsRef} onLoad={() => handleModelLoaded(selectedBridge.id)} onProgress={handleModelProgress} />
                  ) : (
                    <ChengyangYongjiBridge3D bridge={selectedBridge} onClose={handleClosePanel} actionsRef={chengyangActionsRef} onLoad={() => handleModelLoaded(selectedBridge.id)} onProgress={handleModelProgress} />
                  )
                ) : (
                  <>
                    {/* 其他桥：原始底图层 */}
                    <div
                      className="bridge-poster-bg"
                      style={{
                        backgroundImage: selectedBridge.posterImage
                          ? `url(${selectedBridge.posterImage})`
                          : 'none',
                      }}
                    />
                    <div className="bridge-poster-title">{selectedBridge.name}</div>
                    <BridgeCanvas3D bridge={selectedBridge} />
                  </>
                )}

                {/* ── 左侧场景图底部控制栏（手电筒+闪电+重置） ── */}
                {isSpecialBridge && (
                  <div className="bridge-poster-left-controls">
                    <button
                      className={`bridge-poster-left-control-btn${activeActionsRef.current?.isFlashlightOn ? ' active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); activeActionsRef.current?.toggleFlashlight(); setForceUpdate(n => n + 1) }}
                      title={activeActionsRef.current?.isFlashlightOn ? '关闭探照灯' : '打开探照灯'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14l4-4V4a1 1 0 00-1-1H6a1 1 0 00-1 1v6l4 4v5h6v-5z" />
                        <line x1="12" y1="10" x2="12" y2="3" />
                        <line x1="8" y1="14" x2="8" y2="17" />
                        <line x1="16" y1="14" x2="16" y2="17" />
                      </svg>
                    </button>
                    <button
                      className="bridge-poster-left-control-btn"
                      onClick={(e) => { e.stopPropagation(); activeActionsRef.current?.triggerGlitch() }}
                      title="切换贴图模型"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </button>
                    <button
                      className="bridge-poster-left-control-btn"
                      onClick={(e) => { e.stopPropagation(); activeActionsRef.current?.reset(); setForceUpdate(n => n + 1) }}
                      title="重置为初始状态"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* ── 右侧：文字信息区 ── */}
              <div className="bridge-poster-right">
                {/* 卡片底部内容区 — pointer-events:none 父层穿透，关键词按钮 pointer-events:auto 仍可点击 */}
                <div
                  className="bridge-poster-content"
                >
                  {/* 关键词标签栏（竖版排版） */}
                  {selectedBridge.keywords && selectedBridge.keywords.length > 0 && (
                    <div className="bridge-poster-keywords">
                      {selectedBridge.keywords.map((kw, idx) => (
                        <button
                          key={idx}
                          className={`bridge-poster-keyword animate-in${selectedKeywordIdx === idx ? ' active' : ''}`}
                          style={{ animationDelay: `${idx * 0.1}s` } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedKeywordIdx(selectedKeywordIdx === idx ? null : idx)
                          }}
                        >
                          {kw.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 共用详情文字区 */}
                  {selectedKeywordIdx !== null && selectedBridge.keywords?.[selectedKeywordIdx] && (
                    <div className="bridge-poster-detail">
                      <div className="bridge-poster-detail-text">
                        {renderContentWithAnimation(selectedBridge.keywords[selectedKeywordIdx].content)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* ═══ 时光长河 — 长河桥影 ═══ */}
      {showTimeRiver && (
        <TimeRiver
          bridges={bridges}
          onClose={() => setShowTimeRiver(false)}
        />
      )}

    </div>
  )
}
