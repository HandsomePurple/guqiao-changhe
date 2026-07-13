import { useCallback } from 'react'
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
  const handleCameraUpdate = useCallback((pos: THREE.Vector3, target: THREE.Vector3) => {
    onCamChange?.(pos, target)
  }, [onCamChange])

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

    </div>
  )
}
