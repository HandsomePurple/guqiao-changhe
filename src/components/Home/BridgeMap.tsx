import { useState, useCallback, useEffect } from 'react'
import type { Bridge } from '../../types/bridge'
import type * as THREE from 'three'
import Terrain3D from './Terrain3D'

interface CamOverride { pos: THREE.Vector3; target: THREE.Vector3 }

interface Props {
  bridges: Bridge[]
  selectedBridge: Bridge | null
  viewMode: 'global' | 'local'
  focusTarget: THREE.Vector3 | null
  camOverride: CamOverride | null
  filterBridgeId: string | null
  categoryColors: Record<string, string> | null
  onFocusDone?: () => void
  onSelectBridge: (bridge: Bridge) => void
  onCamChange?: (pos: THREE.Vector3, target: THREE.Vector3) => void
}

export default function BridgeMap({ bridges, selectedBridge, viewMode, focusTarget, camOverride, filterBridgeId, categoryColors, onFocusDone, onSelectBridge, onCamChange }: Props) {
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [camInfo, setCamInfo] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  const handleCameraUpdate = useCallback((pos: THREE.Vector3, target: THREE.Vector3) => {
    setCamInfo({ pos: pos.clone(), target: target.clone() })
    onCamChange?.(pos, target)
  }, [onCamChange])

  // Cmd+Shift+E 切换校准模式
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setCalibrateMode(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleCopy = () => {
    if (!camInfo) return
    const text = `{\n  camPos: [${camInfo.pos.x.toFixed(2)}, ${camInfo.pos.y.toFixed(2)}, ${camInfo.pos.z.toFixed(2)}],\n  camTarget: [${camInfo.target.x.toFixed(2)}, ${camInfo.target.y.toFixed(2)}, ${camInfo.target.z.toFixed(2)}]\n}`
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('cam-calib-copy-btn')
      if (btn) { btn.textContent = '已复制!'; setTimeout(() => { btn.textContent = '复制参数' }, 1200) }
    })
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 3D 地形浮雕 — 纯 Three.js */}
      <Terrain3D
        bridges={bridges}
        selectedBridge={selectedBridge}
        viewMode={viewMode}
        focusTarget={focusTarget}
        camOverride={camOverride}
        onFocusDone={onFocusDone}
        onCameraUpdate={handleCameraUpdate}
        onSelectBridge={onSelectBridge}
        categoryColors={categoryColors}
      />

      {/* 全局/局部切换控件 — 已移至底部筛选栏 */}

      {/* 相机校准面板 — 底部右侧 */}
      {calibrateMode && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 16,
          zIndex: 1001,
          background: 'rgba(20,18,14,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(201,168,130,0.35)',
          borderRadius: 10,
          padding: '12px 16px',
          fontFamily: "'SF Mono', 'Menlo', monospace",
          fontSize: 11,
          color: '#C9A882',
          lineHeight: 1.8,
          minWidth: 280,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
        }}>
          {filterBridgeId ? (
            <div style={{ color: '#E8D5B0', fontSize: 12, marginBottom: 6, letterSpacing: 1 }}>
              🔍 {filterBridgeId}
            </div>
          ) : (
            <div style={{ color: '#8A7D6E', fontSize: 11, marginBottom: 6 }}>
              使用 Cmd+Shift+E 打开校准模式，调整相机后点"复制参数"
            </div>
          )}
          {camInfo ? (
            <>
              <div>camPos: [{camInfo.pos.x.toFixed(2)}, {camInfo.pos.y.toFixed(2)}, {camInfo.pos.z.toFixed(2)}]</div>
              <div>camTarget: [{camInfo.target.x.toFixed(2)}, {camInfo.target.y.toFixed(2)}, {camInfo.target.z.toFixed(2)}]</div>
              <button
                id="cam-calib-copy-btn"
                onClick={handleCopy}
                style={{
                  marginTop: 8,
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(201,168,130,0.45)',
                  background: 'rgba(201,168,130,0.15)',
                  color: '#E8D5B0',
                  fontFamily: "'Noto Serif SC', serif",
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all .2s ease',
                  width: '100%',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(201,168,130,0.3)' }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(201,168,130,0.15)' }}
              >
                复制参数
              </button>
            </>
          ) : (
            <div style={{ color: '#6B5E4E', fontStyle: 'italic', fontSize: 10 }}>移动相机中...</div>
          )}
        </div>
      )}
    </div>
  )
}
