import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Bridge } from '../../types/bridge'
import { BRIDGE_TYPE_LABELS, BRIDGE_CATEGORY_COLORS, MAP_BRIDGE_IDS } from '../../data/bridges'
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
  'luoyang-bridge': { camPos: [3.53, 3.39, 5.07], camTarget: [0.35, -1.03, 1.65] },
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
  const shiqikongActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; reset: () => void; showSwipeHint: () => void; isFlashlightOn: boolean; isTexturedOnlyOn: boolean; currentMode: string } | null>(null)
  const wutingqiaoActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; reset: () => void; showSwipeHint: () => void; isFlashlightOn: boolean; isTexturedOnlyOn: boolean; currentMode: string } | null>(null)
  const chengyangActionsRef = useRef<{ toggleFlashlight: () => void; triggerGlitch: () => void; reset: () => void; showSwipeHint: () => void; isFlashlightOn: boolean; isTexturedOnlyOn: boolean; currentMode: string } | null>(null)
  const [, setForceUpdate] = useState(0) // 强制刷新以获取最新 ref 值
  const [showTimeRiver, setShowTimeRiver] = useState(false)
  // 模型桥交互引导状态
  const guideHistoryRef = useRef({ hasScanned: false, hasDragged: false, hasFlashlight: false, hasGlitch: false })
  const [guideTick, setGuideTick] = useState(0)
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

  const mapBridgeSet = useMemo(() => new Set(MAP_BRIDGE_IDS), [])
  const displayBridges = useMemo(() => bridges.filter(b => mapBridgeSet.has(b.id)), [bridges, mapBridgeSet])

  const filteredBridges = useMemo(() => {
    let list = displayBridges
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
  }, [displayBridges, filterType, searchTerm])

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

  // 选中桥变化时重置引导状态
  useEffect(() => {
    guideHistoryRef.current = { hasScanned: false, hasDragged: false, hasFlashlight: false, hasGlitch: false }
    setGuideTick(0)
  }, [selectedBridge?.id])

  // 定期追踪模型桥交互进度
  useEffect(() => {
    if (!isSpecialBridge) return
    const interval = setInterval(() => {
      const mode = activeActionsRef.current?.currentMode
      const isFlashlight = activeActionsRef.current?.isFlashlightOn
      const isTexturedOnly = activeActionsRef.current?.isTexturedOnlyOn
      const prev = guideHistoryRef.current
      const next = {
        hasScanned: prev.hasScanned || (mode !== 'png' && mode !== undefined),
        hasDragged: prev.hasDragged,
        hasFlashlight: prev.hasFlashlight || !!isFlashlight,
        hasGlitch: prev.hasGlitch || !!isTexturedOnly,
      }
      if (next.hasScanned !== prev.hasScanned || next.hasFlashlight !== prev.hasFlashlight || next.hasGlitch !== prev.hasGlitch) {
        guideHistoryRef.current = next
        setGuideTick(n => n + 1)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [isSpecialBridge, activeActionsRef])

  // 场景图区域 pointerdown → 标记用户已开始拖拽（仅非png模式）
  const handleLeftPointerDown = useCallback(() => {
    if (!isSpecialBridge) return
    const mode = activeActionsRef.current?.currentMode
    // png模式下pointerdown是点击扫描，不算拖拽
    if (mode === 'png') return
    if (!guideHistoryRef.current.hasDragged) {
      guideHistoryRef.current.hasDragged = true
      setGuideTick(n => n + 1)
    }
  }, [isSpecialBridge, activeActionsRef])

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
    let list = displayBridges
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
  }, [displayBridges, collectionFilterType, collectionSearch])

  // 拍平列表项（组标题 + 桥项），用于虚拟滚动
  const flatListItems = useMemo(() => {
    const items: Array<{ type: 'group' | 'bridge'; key: string; data: any; height: number }> = []
    const groups = [
      { title: '名桥经典', list: collectionBridges.famous },
      { title: '现代奇迹', list: collectionBridges.modern },
      { title: '古韵悠长', list: collectionBridges.other },
    ]
    for (const g of groups) {
      if (g.list.length > 0) {
        items.push({ type: 'group', key: `group-${g.title}`, data: g.title, height: 32 })
        for (const b of g.list) {
          items.push({ type: 'bridge', key: b.id, data: b, height: 48 })
        }
      }
    }
    return items
  }, [collectionBridges])

  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const virtualItems = useMemo(() => {
    const containerHeight = listRef.current?.clientHeight || 500
    const overscan = 6
    let offset = 0
    let startIdx = 0
    let endIdx = flatListItems.length
    
    for (let i = 0; i < flatListItems.length; i++) {
      if (offset + flatListItems[i].height < scrollTop - 50) {
        startIdx = i + 1
      }
      if (offset > scrollTop + containerHeight + 50) {
        endIdx = i
        break
      }
      offset += flatListItems[i].height
    }
    
    const visibleStart = Math.max(0, startIdx - overscan)
    const visibleEnd = Math.min(flatListItems.length, endIdx + overscan)
    
    let topOffset = 0
    for (let i = 0; i < visibleStart; i++) {
      topOffset += flatListItems[i].height
    }
    
    let totalHeight = 0
    for (const item of flatListItems) {
      totalHeight += item.height
    }
    
    return {
      items: flatListItems.slice(visibleStart, visibleEnd),
      topOffset,
      totalHeight,
    }
  }, [flatListItems, scrollTop])

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

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
            已解锁 {selectedBridge ? 1 : 0} / {displayBridges.length}
          </div>
          <div className="bridge-collection-progress-bar">
            <div
              className="bridge-collection-progress-fill"
              style={{ width: `${(selectedBridge ? 1 : 0) / displayBridges.length * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bridge-collection-list" ref={listRef} onScroll={handleListScroll}>
          {flatListItems.length > 0 ? (
            <div style={{ position: 'relative', height: virtualItems.totalHeight }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualItems.topOffset}px)` }}>
                {virtualItems.items.map(item => {
                  if (item.type === 'group') {
                    return (
                      <div key={item.key} className="bridge-collection-group-title">
                        {item.data}
                      </div>
                    )
                  }
                  const bridge = item.data as Bridge
                  return (
                    <div
                      key={item.key}
                      className={`bridge-collection-item${selectedBridge?.id === bridge.id ? ' selected' : ''}`}
                      onClick={() => handleSelectBridge(bridge)}
                    >
                      <div className="bridge-collection-item-icon">{(BRIDGE_TYPE_LABELS[bridge.type] || bridge.type)[0]}</div>
                      <div className="bridge-collection-item-name">{bridge.name}</div>
                      <div className="bridge-collection-item-city">{bridge.city}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
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
              <div className="bridge-poster-left" onPointerDown={handleLeftPointerDown}>
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
                    {/* 其他桥：场景图或米色占位 */}
                    {selectedBridge.posterImage && selectedBridge.posterImage !== 'images/赵州桥粒子模型背景图.webp' ? (
                      <>
                        <div
                          className="bridge-poster-bg"
                          style={{
                            backgroundImage: `url(${selectedBridge.posterImage})`,
                          }}
                        />
                        <BridgeCanvas3D bridge={selectedBridge} />
                      </>
                    ) : (
                      <div className="bridge-poster-placeholder">
                        <span className="bridge-poster-placeholder-text">场景图待更新</span>
                      </div>
                    )}
                  </>
                )}

                {/* ── 模型桥交互引导浮层（6阶段） ── */}
                {isSpecialBridge && (() => {
                  const mode = activeActionsRef.current?.currentMode
                  const g = guideHistoryRef.current
                  // 阶段1: 引导扫描（png模式，未扫描）
                  if (!g.hasScanned && mode === 'png') {
                    return (
                      <div className="bridge-guide-bubble bridge-guide-bubble--top">
                        <span className="bridge-guide-bubble-text">悬停桥体，点击扫描化为粒子</span>
                        <span className="bridge-guide-bubble-arrow-down">▼</span>
                      </div>
                    )
                  }
                  // 阶段2: 引导拖拽（已扫描进入非png模式，未拖拽未开手电筒）
                  if (g.hasScanned && !g.hasDragged && !g.hasFlashlight && mode !== 'png' && mode !== undefined) {
                    return (
                      <div className="bridge-guide-bubble bridge-guide-bubble--top">
                        <span className="bridge-guide-bubble-text">可拖拽移动旋转观看</span>
                      </div>
                    )
                  }
                  return null
                })()}

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
                      onClick={(e) => {
                        e.stopPropagation()
                        activeActionsRef.current?.reset()
                        setForceUpdate(n => n + 1)
                        setTimeout(() => {
                          activeActionsRef.current?.showSwipeHint()
                        }, 100)
                      }}
                      title="重置为初始状态"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* 阶段3: 手电筒图标上方引导（拖拽后，未开手电筒） */}
                {isSpecialBridge && (() => {
                  const mode = activeActionsRef.current?.currentMode
                  const g = guideHistoryRef.current
                  // 拖拽后且非png模式时显示
                  const showFlashlightTip = g.hasDragged && !g.hasFlashlight && mode !== 'png' && mode !== undefined
                  if (!showFlashlightTip) return null
                  return (
                    <div className="bridge-guide-icon-tooltip bridge-guide-icon-tooltip--flashlight">
                      <span className="bridge-guide-icon-tooltip-arrow">▼</span>
                      <span className="bridge-guide-icon-tooltip-text">开启手电筒模式，悬停桥体探微</span>
                    </div>
                  )
                })()}

                {/* 阶段4: 闪电图标上方引导（已开手电筒，未触发闪电） */}
                {isSpecialBridge && (() => {
                  const mode = activeActionsRef.current?.currentMode
                  const g = guideHistoryRef.current
                  const showLightningTip = g.hasFlashlight && !g.hasGlitch && mode === 'particle'
                  if (!showLightningTip) return null
                  return (
                    <div className="bridge-guide-icon-tooltip bridge-guide-icon-tooltip--lightning">
                      <span className="bridge-guide-icon-tooltip-arrow">▼</span>
                      <span className="bridge-guide-icon-tooltip-text">一键切换模型</span>
                    </div>
                  )
                })()}

                {/* 阶段5: 重置图标上方引导（已触发闪电变成贴图模型） */}
                {isSpecialBridge && (() => {
                  const mode = activeActionsRef.current?.currentMode
                  const g = guideHistoryRef.current
                  // 闪电完成（texturedOnlyOn=true），mode仍为particle时显示
                  const showResetTip = g.hasGlitch && mode === 'particle'
                  if (!showResetTip) return null
                  return (
                    <div className="bridge-guide-icon-tooltip bridge-guide-icon-tooltip--reset">
                      <span className="bridge-guide-icon-tooltip-arrow">▼</span>
                      <span className="bridge-guide-icon-tooltip-text">返回场景图</span>
                    </div>
                  )
                })()}

              </div>

              {/* ── 右侧：文字信息区 ── */}
              <div className="bridge-poster-right">
                <div className="bridge-info-content">
                  {/* 基本信息 */}
                  <div className="bridge-info-section">
                    <div className="bridge-info-meta">
                      <span>{selectedBridge.era} · {selectedBridge.year}</span>
                      <span className="bridge-info-meta-divider">|</span>
                      <span>{BRIDGE_TYPE_LABELS[selectedBridge.type] || selectedBridge.type}</span>
                      <span className="bridge-info-meta-divider">|</span>
                      <span>{selectedBridge.length}</span>
                    </div>
                  </div>

                  {/* 桥梁简介 */}
                  <div className="bridge-info-section">
                    <div className="bridge-info-title">桥梁简介</div>
                    <div className="bridge-info-text">{selectedBridge.description}</div>
                  </div>

                  {/* 历史故事 */}
                  <div className="bridge-info-section">
                    <div className="bridge-info-title">历史故事</div>
                    <div className="bridge-info-text">{selectedBridge.history}</div>
                  </div>

                  {/* 特色亮点 */}
                  <div className="bridge-info-section">
                    <div className="bridge-info-title">特色亮点</div>
                    <ul className="bridge-info-features">
                      {selectedBridge.features.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 诗词文化（仅有诗词时显示） */}
                  {selectedBridge.poems && selectedBridge.poems.length > 0 && (
                    <div className="bridge-info-section">
                      <div className="bridge-info-title">诗词文化</div>
                      {selectedBridge.poems.map((p, i) => (
                        <div key={i} className="bridge-info-poem">
                          <div className="bridge-info-poem-title">《{p.title}》 — {p.author}</div>
                          <div className="bridge-info-poem-lines">
                            {p.lines.map((l, j) => (
                              <span key={j}>{l}{j < p.lines.length - 1 ? '，' : ''}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 观赏指南（仅有数据时显示） */}
                  {selectedBridge.viewingSpots && selectedBridge.viewingSpots.length > 0 && (
                    <div className="bridge-info-section">
                      <div className="bridge-info-title">观赏指南</div>
                      {selectedBridge.viewingSpots.map((s, i) => (
                        <div key={i} className="bridge-info-spot">
                          <span className="bridge-info-spot-name">{s.name}</span>
                          <span className="bridge-info-spot-desc">{s.desc}</span>
                          {s.tip && <span className="bridge-info-spot-tip">{s.tip}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 文旅信息（仅有数据时显示） */}
                  {(selectedBridge.openingHours || selectedBridge.ticket || (selectedBridge.nearbyAttractions && selectedBridge.nearbyAttractions.length > 0)) && (
                    <div className="bridge-info-section">
                      <div className="bridge-info-title">文旅信息</div>
                      <div className="bridge-info-tourism">
                        {selectedBridge.openingHours && (
                          <div className="bridge-info-tourism-row">
                            <span className="bridge-info-tourism-label">开放时间</span>
                            <span className="bridge-info-tourism-value">{selectedBridge.openingHours}</span>
                          </div>
                        )}
                        {selectedBridge.ticket && (
                          <div className="bridge-info-tourism-row">
                            <span className="bridge-info-tourism-label">门票</span>
                            <span className="bridge-info-tourism-value">{selectedBridge.ticket}</span>
                          </div>
                        )}
                        {selectedBridge.nearbyAttractions && selectedBridge.nearbyAttractions.length > 0 && (
                          <div className="bridge-info-tourism-row">
                            <span className="bridge-info-tourism-label">周边景点</span>
                            <span className="bridge-info-tourism-value">{selectedBridge.nearbyAttractions.join('、')}</span>
                          </div>
                        )}
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
