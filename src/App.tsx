import { useState, useCallback } from 'react'
import type { Bridge } from './types/bridge'
import { bridges } from './data/bridges'
import HomePage from './components/Home/HomePage'
import PanoramaViewer from './components/Panorama/PanoramaViewer'
import './index.css'

export default function App() {

  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null)
  const [showPanorama, setShowPanorama] = useState(false)
  const [panoramaBridge, setPanoramaBridge] = useState<Bridge | null>(null)
  const [unlockedPanoramas, setUnlockedPanoramas] = useState<Set<string>>(new Set())

  const handleSelectBridge = useCallback((bridge: Bridge | null) => {
    setSelectedBridge(bridge)
  }, [])

  const handleOpenPanorama = useCallback((bridge: Bridge) => {
    setPanoramaBridge(bridge)
    setShowPanorama(true)
    setUnlockedPanoramas(prev => new Set([...prev, bridge.id]))
  }, [])

  const handleClosePanorama = useCallback(() => {
    setShowPanorama(false)
    setPanoramaBridge(null)
  }, [])

  return (
    <div className="w-full h-full" style={{ background: '#E1D7EF' }}>
      <HomePage
        bridges={bridges}
        selectedBridge={selectedBridge}
        unlockedPanoramas={unlockedPanoramas}
        onSelectBridge={handleSelectBridge}
        onOpenPanorama={handleOpenPanorama}
      />

      {showPanorama && panoramaBridge && (
        <PanoramaViewer
          bridge={panoramaBridge}
          onClose={handleClosePanorama}
        />
      )}
    </div>
  )
}
