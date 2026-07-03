import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { Bridge } from '../../types/bridge'

// ============================================================
// 手绘 PLY 路径映射（与 BridgeCanvas3D 共享）
// ============================================================
const PLY_MODEL_MAP: Record<string, string> = {
  zhaozhou: 'models/赵州桥.ply',
}

// ============================================================
// 小型 3D 粒子场景（hover 浮窗内）
// ============================================================
function MiniPlyScene({ bridge }: { bridge: Bridge }) {
  const groupRef = useRef<THREE.Group>(null)
  const plyPath = PLY_MODEL_MAP[bridge.id]
  const geometry = useLoader(PLYLoader, plyPath || '')

  const { positions, colors } = useMemo(() => {
    if (!geometry) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    const posAttr = geometry.getAttribute('position')
    const colAttr = geometry.getAttribute('color')

    const count = posAttr.count
    const col = new Float32Array(count * 3)
    const tempColor = new THREE.Color()

    if (colAttr) {
      for (let i = 0; i < count; i++) {
        tempColor.set(
          colAttr.getX(i) / 255,
          colAttr.getY(i) / 255,
          colAttr.getZ(i) / 255,
        )
        // 暖金增强
        tempColor.r = Math.min(1, tempColor.r * 1.06 + 0.05)
        tempColor.g = Math.min(1, tempColor.g * 1.03 + 0.03)
        tempColor.b = Math.min(1, tempColor.b * 0.90)
        col[i * 3] = tempColor.r
        col[i * 3 + 1] = tempColor.g
        col[i * 3 + 2] = tempColor.b
      }
    } else {
      const baseColor = new THREE.Color('#C9A882')
      for (let i = 0; i < count; i++) {
        const c = baseColor.clone()
        c.r += (Math.random() - 0.5) * 0.08
        c.g += (Math.random() - 0.5) * 0.06
        c.b += (Math.random() - 0.5) * 0.06
        col[i * 3] = c.r
        col[i * 3 + 1] = c.g
        col[i * 3 + 2] = c.b
      }
    }

    return { positions: posAttr.array as Float32Array, colors: col }
  }, [geometry])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.18) * 0.08
    groupRef.current.position.y = Math.sin(t * 0.35) * 0.04
  })

  if (positions.length === 0) return null

  return (
    <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
      {/* 桥体 PLY 粒子 */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.78}
        />
      </points>

      {/* 底部淡青水纹粒子 */}
      <MiniWaterParticles />
    </group>
  )
}

function MiniWaterParticles() {
  const ref = useRef<THREE.Points>(null)
  const { positions } = useMemo(() => {
    const count = 300
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8
      pos[i * 3 + 1] = -2.2 + Math.random() * 0.25
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5
    }
    return { positions: pos }
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.PointsMaterial
    mat.opacity = 0.25 + Math.sin(clock.getElapsedTime() * 0.4) * 0.06
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#6B8E7A"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.28}
      />
    </points>
  )
}

// ============================================================
// 外部容器
// ============================================================
interface Props {
  bridge: Bridge
  x: number
  y: number
  visible: boolean
}

const PANEL_W = 148
const PANEL_H = 128

export default function BridgeHoverPreview({ bridge, x, y, visible }: Props) {
  const [show, setShow] = useState(false)
  const plyPath = PLY_MODEL_MAP[bridge.id]

  // 延迟入场（避免快速划过时闪烁）
  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), 180)
    return () => clearTimeout(timer)
  }, [visible])

  if (!plyPath) return null

  // 计算位置（图标右上方偏移）
  const left = x + 18
  const top = y - PANEL_H - 16

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: PANEL_W,
        height: PANEL_H,
        zIndex: 1500,
        pointerEvents: 'none',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(0.85)',
        transition: 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {/* 古风边框 + 背景 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 10,
          border: '1px solid rgba(201,168,130,0.4)',
          background: 'rgba(20,15,10,0.72)',
          backdropFilter: 'blur(16px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
          boxShadow: '0 0 20px rgba(201,168,130,0.15), 0 0 48px rgba(201,168,130,0.06), 0 8px 32px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      />

      {/* 金色内发光边框效果 */}
      <div
        style={{
          position: 'absolute',
          inset: 2,
          borderRadius: 8,
          border: '1px solid rgba(212,175,55,0.18)',
          boxShadow: 'inset 0 0 16px rgba(201,168,130,0.08)',
          pointerEvents: 'none',
        }}
      />

      {/* Three.js Canvas */}
      <Canvas
        className="absolute inset-0 z-0"
        camera={{ position: [0, 0.2, 4.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ borderRadius: 10 }}
      >
        <ambientLight intensity={0.5} color="#FFF8F0" />
        <directionalLight position={[5, 8, 4]} intensity={0.6} color="#FFF5E6" />
        <pointLight position={[0, -2, 0]} intensity={0.35} color="#C9A882" />
        <MiniPlyScene bridge={bridge} />
      </Canvas>

      {/* 底部桥名 */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 11,
            color: 'rgba(232,213,176,0.75)',
            letterSpacing: '3px',
            textShadow: '0 0 6px rgba(255,240,180,0.25)',
          }}
        >
          {bridge.name}
        </span>
      </div>
    </div>
  )
}
