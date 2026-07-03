import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import type { Bridge } from '../../types/bridge'

// ═══════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════

type Mode =
  | 'png'
  | 'scanline-in'
  | 'textured'
  | 'dissolving'
  | 'compare'
  | 'particle'
  | 'glitching'

interface Props {
  bridge: Bridge
  onClose: () => void
  actionsRef?: React.MutableRefObject<{
    toggleFlashlight: () => void
    triggerGlitch: () => void
    isFlashlightOn: boolean
    currentMode: Mode
  } | null>
}

// ═══════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════

const OBJ_DIR = 'models/十七孔桥带贴图模型压缩/'
const OBJ_NAME = 'Meshy_AI_Seventeen_Arch_Bridge_0611074212_texture.obj'
const MTL_NAME = 'Meshy_AI_Seventeen_Arch_Bridge_0611074212_texture.mtl'

const BASE_STEP = 2
const BRIDGE_SPAN = 4

// ═══════════════════════════════════════════════════════════
// 编辑器中数值输入控件
// ═══════════════════════════════════════════════════════════

function CalibInput({
  label, value, onChange, step = 0.05,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="sq-calib-input">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CameraSync
// ═══════════════════════════════════════════════════════════

const DEFAULT_TARGET = new THREE.Vector3(-0.56, 0.01, 0.77)

function CameraSync({
  onCameraChange,
  orbitEnabled,
  autoRotate = false,
  onOrbitDragEnd,
}: {
  onCameraChange: (pos: THREE.Vector3, target: THREE.Vector3) => void
  orbitEnabled: boolean
  autoRotate?: boolean
  onOrbitDragEnd?: () => void
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const cmdRef = useRef(false)
  const autoRotateRef = useRef(autoRotate)

  // 追踪 Cmd 键
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Meta') cmdRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Meta') cmdRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.copy(DEFAULT_TARGET)
      controlsRef.current.update()
    }
  }, [])

  // autoRotate prop 变化时同步到 controls ref
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate
    }
    autoRotateRef.current = autoRotate
  }, [autoRotate])

  // 监听 OrbitControls 拖拽结束 → 触发自动旋转
  useEffect(() => {
    const ctrl = controlsRef.current
    if (!ctrl) return
    const handleEnd = () => {
      if (!ctrl.autoRotate && onOrbitDragEnd) onOrbitDragEnd()
    }
    ctrl.addEventListener('end', handleEnd)
    return () => ctrl.removeEventListener('end', handleEnd)
  }, [onOrbitDragEnd])

  // 每帧：同步 autoRotate（抵抗 drei 可能的重置）+ 鼠标映射
  useFrame(() => {
    if (controlsRef.current) {
      const ctrl = controlsRef.current
      // 强制同步 autoRotate，防止 drei 内部重置
      if (ctrl.autoRotate !== autoRotateRef.current) {
        ctrl.autoRotate = autoRotateRef.current
      }
      onCameraChange(camera.position.clone(), (ctrl.target as THREE.Vector3).clone())
      // LEFT: 0=ROTATE, 2=PAN; MIDDLE: 1=DOLLY
      ctrl.mouseButtons.LEFT = cmdRef.current ? 0 : 2
      ctrl.mouseButtons.MIDDLE = 1
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      target={DEFAULT_TARGET}
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={14}
      autoRotate={autoRotate}
      autoRotateSpeed={0.4}
    />
  )
}

// ═══════════════════════════════════════════════════════════
// TexturedModel — MTLLoader + OBJLoader 贴图实体
// ═══════════════════════════════════════════════════════════

function TexturedModel({
  opacity,
  dissolveProgress,
  visible,
}: {
  opacity: number
  dissolveProgress: number
  visible: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [obj, setObj] = useState<THREE.Group | null>(null)

  // 手动加载：先 MTL(preload 纹理) → 再 OBJ，确保纹理已加载
  useEffect(() => {
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath(OBJ_DIR)
    mtlLoader.setResourcePath(OBJ_DIR)
    mtlLoader.load(MTL_NAME, (materials) => {
      materials.preload()
      Object.keys(materials.materials).forEach((name) => {
        const m = materials.materials[name]
        if (m) {
          m.emissive.set(0x000000)
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace
            m.map.needsUpdate = true
          }
          m.needsUpdate = true
        }
      })

      const objLoader = new OBJLoader()
      objLoader.setPath(OBJ_DIR)
      objLoader.setMaterials(materials)
      objLoader.load(OBJ_NAME, (loadedObj) => {
        setObj(loadedObj)
      })
    })
  }, [])

  // 计算 bbox + 居中缩放
  const transform = useMemo(() => {
    if (!obj) return { minY: -2, maxY: 2, scale: 1, cx: 0, cy: 0, cz: 0 }
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const geo = (child as THREE.Mesh).geometry
        geo.computeBoundingBox()
        if (geo.boundingBox) {
          minX = Math.min(minX, geo.boundingBox.min.x); maxX = Math.max(maxX, geo.boundingBox.max.x)
          minY = Math.min(minY, geo.boundingBox.min.y); maxY = Math.max(maxY, geo.boundingBox.max.y)
          minZ = Math.min(minZ, geo.boundingBox.min.z); maxZ = Math.max(maxZ, geo.boundingBox.max.z)
        }
      }
    })
    if (minY === Infinity) return { minY: -2, maxY: 2, scale: 1, cx: 0, cy: 0, cz: 0 }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2
    const maxSize = Math.max(maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1)
    const scale = BRIDGE_SPAN / maxSize
    return { minY, maxY, scale, cx, cy, cz }
  }, [obj])

  // 每帧更新材质 opacity + dissolve clipping plane
  useFrame(() => {
    if (!obj) return
    const { minY, maxY } = transform

    obj.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        if (m) {
          m.transparent = true
          m.opacity = opacity
          m.depthWrite = opacity > 0.9

          if (dissolveProgress > 0) {
            const clipY = minY + (maxY - minY) * dissolveProgress
            m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)]
            m.clipShadows = true
          } else {
            m.clippingPlanes = null
          }
          m.needsUpdate = true
        }
      })
    })
  })

  return (
    <group
      ref={groupRef}
      visible={visible && !!obj}
      scale={[transform.scale, transform.scale, transform.scale]}
      position={[-transform.cx * transform.scale, -transform.cy * transform.scale, -transform.cz * transform.scale]}
    >
      {obj && <primitive object={obj} />}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════
// 探照灯着色器 — 屏幕空间圆形遮罩
// ═══════════════════════════════════════════════════════════

const FLASHLIGHT_VERTEX = /* glsl */ `
varying vec4 vClipPos;
varying vec2 vUv;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vClipPos = projectionMatrix * mvPosition;
  vUv = uv;
  gl_Position = vClipPos;
}
`

const FLASHLIGHT_FRAGMENT = /* glsl */ `
varying vec4 vClipPos;
varying vec2 vUv;
uniform sampler2D uMap;
uniform vec2 uMouseNDC;
uniform float uRadius;
uniform float uFeather;

void main() {
  vec2 ndc = vClipPos.xy / vClipPos.w;
  float dist = distance(ndc, uMouseNDC);
  float mask = 1.0 - smoothstep(uRadius - uFeather, uRadius, dist);

  vec4 texColor = texture2D(uMap, vUv);

  // 探照灯内部微微提亮
  float glow = 1.0 + mask * 0.08;
  gl_FragColor = vec4(texColor.rgb * glow, texColor.a * mask);
}
`

// ═══════════════════════════════════════════════════════════
// FlashlightModel — 贴图模型 + 屏幕空间探照灯遮罩
// ═══════════════════════════════════════════════════════════

function FlashlightModel({
  mouseNDCRef,
  visible,
}: {
  mouseNDCRef: React.MutableRefObject<THREE.Vector2>
  visible: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const matRefs = useRef<THREE.ShaderMaterial[]>([])
  const flashApplied = useRef(false)

  // 加载 OBJ + MTL（与 TexturedModel 完全相同）
  const [obj, setObj] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath(OBJ_DIR)
    mtlLoader.setResourcePath(OBJ_DIR)
    mtlLoader.load(MTL_NAME, (materials) => {
      materials.preload()
      Object.keys(materials.materials).forEach((name) => {
        const m = materials.materials[name]
        if (m) {
          m.emissive.set(0x000000)
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace
            m.map.needsUpdate = true
          }
          m.needsUpdate = true
        }
      })

      const objLoader = new OBJLoader()
      objLoader.setPath(OBJ_DIR)
      objLoader.setMaterials(materials)
      objLoader.load(OBJ_NAME, (loadedObj) => {
        setObj(loadedObj)
      })
    })
  }, [])

  // 加载后替换所有材质为探照灯 ShaderMaterial
  useEffect(() => {
    if (!obj || flashApplied.current) return
    flashApplied.current = true

    const newMats: THREE.ShaderMaterial[] = []
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const replacementMats: THREE.ShaderMaterial[] = []

        mats.forEach((oldMat) => {
          if (!oldMat) return
          const map = (oldMat as any).map || null
          const shaderMat = new THREE.ShaderMaterial({
            uniforms: {
              uMap: { value: map },
              uMouseNDC: { value: new THREE.Vector2(0, 0) },
              uRadius: { value: 0.40 },
              uFeather: { value: 0.22 },
            },
            vertexShader: FLASHLIGHT_VERTEX,
            fragmentShader: FLASHLIGHT_FRAGMENT,
            transparent: true,
            depthWrite: false,
          })
          replacementMats.push(shaderMat)
          newMats.push(shaderMat)
        })

        if (replacementMats.length === 1) {
          mesh.material = replacementMats[0]
        } else {
          mesh.material = replacementMats
        }
      }
    })
    matRefs.current = newMats
  }, [obj])

  // 每帧更新鼠标位置 uniform
  useFrame(() => {
    for (const mat of matRefs.current) {
      if (mat.uniforms) {
        mat.uniforms.uMouseNDC.value.copy(mouseNDCRef.current)
      }
    }
  })

  // 计算 bbox + 居中缩放（与 TexturedModel 相同）
  const transform = useMemo(() => {
    if (!obj) return { minY: -2, maxY: 2, scale: 1, cx: 0, cy: 0, cz: 0 }
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const geo = (child as THREE.Mesh).geometry
        geo.computeBoundingBox()
        if (geo.boundingBox) {
          minX = Math.min(minX, geo.boundingBox.min.x); maxX = Math.max(maxX, geo.boundingBox.max.x)
          minY = Math.min(minY, geo.boundingBox.min.y); maxY = Math.max(maxY, geo.boundingBox.max.y)
          minZ = Math.min(minZ, geo.boundingBox.min.z); maxZ = Math.max(maxZ, geo.boundingBox.max.z)
        }
      }
    })
    if (minY === Infinity) return { minY: -2, maxY: 2, scale: 1, cx: 0, cy: 0, cz: 0 }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2
    const maxSize = Math.max(maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1)
    const scale = BRIDGE_SPAN / maxSize
    return { minY, maxY, scale, cx, cy, cz }
  }, [obj])

  return (
    <group
      ref={groupRef}
      visible={visible && !!obj}
      scale={[transform.scale, transform.scale, transform.scale]}
      position={[-transform.cx * transform.scale, -transform.cy * transform.scale, -transform.cz * transform.scale]}
    >
      {obj && <primitive object={obj} />}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════
// ParticleCloud — OBJ 顶点 → 粒子
// ═══════════════════════════════════════════════════════════

function ParticleCloud({
  opacity,
  visible,
}: {
  opacity: number
  visible: boolean
}) {
  const obj = useLoader(OBJLoader, OBJ_NAME, (loader) => {
    loader.setPath(OBJ_DIR)
  })

  const { positions, colors } = useMemo(() => {
    console.log('[十七孔桥粒子] useMemo start, obj:', !!obj)
    if (!obj) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    // 预遍历：计算 Y 轴范围 + 总顶点数
    let totalVerts = 0
    let meshCount = 0
    let preMinY = Infinity, preMaxY = -Infinity
    obj.traverse((child) => {
      if ((child as any).geometry) {
        const posAttr = (child as any).geometry.getAttribute('position')
        if (posAttr) {
          totalVerts += posAttr.count
          meshCount++
          for (let j = 0; j < posAttr.count; j += 100) {
            const y = posAttr.getY(j)
            if (y < preMinY) preMinY = y
            if (y > preMaxY) preMaxY = y
          }
        }
      }
    })
    const preYRange = preMaxY - preMinY || 0.001
    console.log('[十七孔桥粒子] totalVerts:', totalVerts, 'meshes:', meshCount, 'Y范围:', preMinY.toFixed(3), '~', preMaxY.toFixed(3))

    // 结构感知密度 — 上层密(屋顶) > 中层中(悬梁) > 下层疏(基座)
    // BASE_STEP=4 降采样 + 100%/65%/38% 保留率（与五亭桥完全一致）
    const rawPositions: number[] = []
    obj.traverse((child) => {
      if ((child as any).geometry) {
        const geo = (child as any).geometry
        const posAttr = geo.getAttribute('position')
        if (!posAttr) return
        child.updateWorldMatrix(true, false)
        const matrix = child.matrixWorld
        for (let i = 0; i < posAttr.count; i += BASE_STEP) {
          const rawY = posAttr.getY(i)
          const ny = (rawY - preMinY) / preYRange
          let keepProb = 1.0
          if (ny > 0.6) {
            keepProb = 1.0     // 屋顶/上层 → 全保留
          } else if (ny > 0.3) {
            keepProb = 0.65    // 悬梁/中层 → 保留65%
          } else {
            keepProb = 0.38    // 基座/下层 → 保留38%
          }
          if (Math.random() > keepProb) continue
          const v = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i),
          )
          v.applyMatrix4(matrix)
          rawPositions.push(v.x, v.y, v.z)
        }
      }
    })

    console.log('[十七孔桥粒子] rawPositions.length:', rawPositions.length)
    if (rawPositions.length === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    // 归一化缩放：模型坐标 → 场景可见范围
    const count = rawPositions.length / 3
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < count; i++) {
      const x = rawPositions[i * 3]
      const y = rawPositions[i * 3 + 1]
      const z = rawPositions[i * 3 + 2]
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const cz = (minZ + maxZ) / 2
    const maxSize = Math.max(maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1)
    const scale = BRIDGE_SPAN / maxSize
    console.log('[十七孔桥粒子] bbox:', {
      minX: minX.toFixed(2), maxX: maxX.toFixed(2),
      minY: minY.toFixed(2), maxY: maxY.toFixed(2),
      minZ: minZ.toFixed(2), maxZ: maxZ.toFixed(2),
      maxSize: maxSize.toFixed(2), scale: scale.toFixed(3),
    })

    const allPositions = new Float32Array(rawPositions.length)
    for (let i = 0; i < count; i++) {
      allPositions[i * 3]     = (rawPositions[i * 3]     - cx) * scale
      allPositions[i * 3 + 1] = (rawPositions[i * 3 + 1] - cy) * scale
      allPositions[i * 3 + 2] = (rawPositions[i * 3 + 2] - cz) * scale
    }

    // Y轴(上中下) × Z轴(前中后) = 9区色彩矩阵（与五亭桥完全一致）
    const yRange = maxY - minY || 0.001
    const zRange = maxZ - minZ || 0.001
    const col = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const rawY = rawPositions[i * 3 + 1]
      const rawZ = rawPositions[i * 3 + 2]
      const normalizedY = (rawY - minY) / yRange
      const normalizedZ = (rawZ - minZ) / zRange

      let r: number, g: number, b: number

      // Y轴分层着色
      if (normalizedY > 0.6) {
        // 上层屋顶 → 暖铜色（暗）
        const t = (normalizedY - 0.6) / 0.4
        r = 0.72 + t * 0.14
        g = 0.52 + t * 0.18
        b = 0.26 + t * 0.16
      } else if (normalizedY > 0.3) {
        // 中层悬梁 → 暖黄色（中）
        const t = (normalizedY - 0.3) / 0.3
        r = 0.86 + t * 0.10
        g = 0.70 + t * 0.14
        b = 0.42 + t * 0.18
      } else {
        // 下层基座 → 亮金色（最亮）
        const t = normalizedY / 0.3
        r = 0.96 + t * 0.04
        g = 0.84 + t * 0.14
        b = 0.60 + t * 0.34
      }

      // Z轴深度因子：前亮→后暗
      let zFactor: number
      if (normalizedZ > 0.66) {
        zFactor = 1.0  // 前面：保留原亮度
      } else if (normalizedZ > 0.33) {
        const t = (normalizedZ - 0.33) / 0.33
        zFactor = 0.72 + t * 0.28  // 0.72 → 1.0
      } else {
        const t = normalizedZ / 0.33
        zFactor = 0.50 + t * 0.22  // 0.50 → 0.72
      }

      r *= zFactor
      g *= zFactor
      b *= zFactor

      // 微弱随机扰动，保留自然感
      const noise = (Math.random() - 0.5) * 0.04
      col[i * 3]     = Math.min(1, r + noise)
      col[i * 3 + 1] = Math.min(1, g + noise)
      col[i * 3 + 2] = Math.min(1, b + noise)
    }

    console.log('[十七孔桥粒子] 粒子数:', count)
    return { positions: allPositions, colors: col }
  }, [obj])

  if (positions.length === 0) return null

  return (
    <points visible={visible} scale={[1, 1, 1]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.013}
        vertexColors
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={opacity}
        sizeAttenuation
      />
    </points>
  )
}

// ═══════════════════════════════════════════════════════════
// ThreeScene — 共享 Canvas 场景
// ═══════════════════════════════════════════════════════════

function ThreeScene({
  mode,
  dissolveProgress,
  texturedOpacity,
  particleOpacity,
  showTextured,
  showParticle,
  onCameraChange,
  calibrateMode,
  modelPos, modelRot, modelScale,
  partPos, partRot, partScale,
  onModelChange,
  onPartChange,
  onPartDragEnd,
  mouseNDCRef,
  isFlashlight,
  autoRotate,
  onOrbitDragEnd,
}: {
  mode: Mode
  dissolveProgress: number
  texturedOpacity: number
  particleOpacity: number
  showTextured: boolean
  showParticle: boolean
  onCameraChange: (pos: THREE.Vector3, target: THREE.Vector3) => void
  calibrateMode: boolean
  modelPos: [number, number, number]
  modelRot: [number, number, number]
  modelScale: number
  partPos: [number, number, number]
  partRot: [number, number, number]
  partScale: number
  onModelChange?: (pos: [number, number, number], rot: [number, number, number], scale: number) => void
  onPartChange?: (pos: [number, number, number], rot: [number, number, number], scale: number) => void
  onPartDragEnd?: () => void
  mouseNDCRef: React.MutableRefObject<THREE.Vector2>
  isFlashlight: boolean
  autoRotate: boolean
  onOrbitDragEnd?: () => void
}) {
  const modelGroupRef = useRef<THREE.Group>(null)
  const partGroupRef = useRef<THREE.Group>(null)
  const [tcDragging, setTcDragging] = useState(false)

  const handleModelChange = useCallback(() => {
    if (!modelGroupRef.current || !onModelChange) return
    const p = modelGroupRef.current.position
    const r = modelGroupRef.current.rotation
    const s = modelGroupRef.current.scale
    onModelChange([p.x, p.y, p.z], [r.x, r.y, r.z], s.x)
  }, [onModelChange])

  const handlePartChange = useCallback(() => {
    if (!partGroupRef.current || !onPartChange) return
    const p = partGroupRef.current.position
    const r = partGroupRef.current.rotation
    const s = partGroupRef.current.scale
    onPartChange([p.x, p.y, p.z], [r.x, r.y, r.z], s.x)
  }, [onPartChange])

  return (
    <>
      <fog attach="fog" args={['#E1D7EF', 12, 32]} />
      {/* 暖色明亮灯光 — 匹配原始贴图暖色调 */}
      <hemisphereLight args={['#FFF8EE', '#C4A87C', 1.0]} />
      <ambientLight intensity={1.2} color="#FFF8F0" />
      <directionalLight position={[8, 10, 5]} intensity={1.5} color="#FFF5E6" />
      <directionalLight position={[-5, 3, -4]} intensity={0.6} color="#F0E0C8" />
      <pointLight position={[0, -3, 0]} intensity={0.8} color="#C9A882" distance={30} />
      <pointLight position={[0, 6, 0]} intensity={0.65} color="#FFF8EE" distance={30} />
      <pointLight position={[0, 3, -5]} intensity={0.5} color="#D8CFC0" distance={30} />
      <pointLight position={[0, 2, 4]} intensity={0.5} color="#FFE8CC" distance={25} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial color="#D3B885" transparent opacity={0.04} depthWrite={false} />
      </mesh>

      {/* 态B — 贴图模型（始终挂载，OBJ 后台预加载，visible 控制显示） */}
        <group
          ref={modelGroupRef}
          position={calibrateMode ? modelPos : [-1.55, 0.01, -0.31]}
          rotation={calibrateMode ? modelRot : [0, 0, 0]}
          scale={calibrateMode ? [modelScale, modelScale, modelScale] : [1.23, 1.23, 1.23]}
          renderOrder={0}
          visible={showTextured}
        >
          <TexturedModel
            opacity={texturedOpacity}
            dissolveProgress={mode === 'dissolving' ? dissolveProgress : 0}
            visible={showTextured}
          />
        </group>
        {calibrateMode && modelGroupRef.current && (
          <TransformControls
            object={modelGroupRef.current}
            mode="translate"
            onObjectChange={handleModelChange}
            onDraggingChange={setTcDragging}
          />
        )}

      {/* FlashlightModel — 始终挂载，OBJ 后台预加载，visible 控制显示 */}
        <group position={[-1.55, 0.01, -0.31]} rotation={[0, 0, 0]} scale={[1.23, 1.23, 1.23]}>
          <FlashlightModel mouseNDCRef={mouseNDCRef} visible={isFlashlight} />
        </group>

      {/* 态C — 粒子云（与贴图模型对齐，校准模式可用编辑器调整定位） */}
      <group
        ref={partGroupRef}
        position={calibrateMode ? partPos : [-1.55, 0.01, -0.31]}
        rotation={calibrateMode ? partRot : [0, 0, 0]}
        scale={calibrateMode ? [partScale, partScale, partScale] : [1.23, 1.23, 1.23]}
        renderOrder={1}
      >
        <ParticleCloud
          opacity={particleOpacity}
          visible={showParticle}
        />
      </group>
      {calibrateMode && partGroupRef.current && (
        <TransformControls
          object={partGroupRef.current}
          mode="translate"
          onObjectChange={handlePartChange}
          onDraggingChange={(dragging: boolean) => { if (!dragging) onPartDragEnd?.() }}
        />
      )}

      <CameraSync onCameraChange={onCameraChange} orbitEnabled={calibrateMode || mode === 'particle'} autoRotate={autoRotate} onOrbitDragEnd={onOrbitDragEnd} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// ScanlineBar — CSS 扫描线
// ═══════════════════════════════════════════════════════════

function ScanlineBar({ position, visible }: { position: number; visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="sq-scanline-bar"
      style={{ top: `${position * 100}%` }}
    />
  )
}

// ═══════════════════════════════════════════════════════════
// GlitchOverlay — Glitch 双向故障信号
// ═══════════════════════════════════════════════════════════

function GlitchOverlay({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (active) {
      const t = setTimeout(onComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [active, onComplete])

  if (!active) return null

  // 粒子碎片 — 10 块，小而分散
  const pf: Array<{ clip: string; dx: number; dy: number; dr: number }> = [
    { clip: 'polygon(0 0, 18% 0, 14% 22%, 0 20%)', dx: -4, dy: 1, dr: -1.5 },
    { clip: 'polygon(16% 0, 34% 0, 30% 26%, 12% 24%)', dx: 5, dy: -2, dr: 1 },
    { clip: 'polygon(32% 0, 50% 0, 46% 20%, 28% 22%)', dx: -3, dy: 3, dr: -1 },
    { clip: 'polygon(48% 0, 66% 0, 62% 28%, 44% 24%)', dx: 6, dy: -1, dr: 2 },
    { clip: 'polygon(64% 0, 82% 0, 78% 18%, 60% 20%)', dx: -5, dy: 2, dr: -2 },
    { clip: 'polygon(80% 0, 100% 0, 100% 24%, 76% 22%)', dx: 4, dy: -3, dr: 1.5 },
    { clip: 'polygon(0 18%, 16% 20%, 12% 48%, 0 46%)', dx: -6, dy: 2, dr: -3 },
    { clip: 'polygon(14% 22%, 32% 24%, 28% 52%, 10% 50%)', dx: 7, dy: -2, dr: 1 },
    { clip: 'polygon(30% 20%, 48% 22%, 44% 50%, 26% 48%)', dx: -4, dy: 4, dr: -1 },
    { clip: 'polygon(46% 22%, 65% 26%, 60% 54%, 42% 50%)', dx: 3, dy: -3, dr: 2 },
  ]
  // PNG 回退碎片 — 6 块，底部为主
  const af: Array<{ clip: string; dx: number; dy: number; dr: number }> = [
    { clip: 'polygon(0 46%, 18% 44%, 14% 74%, 0 72%)', dx: -7, dy: 3, dr: 2 },
    { clip: 'polygon(16% 48%, 34% 46%, 30% 76%, 12% 74%)', dx: 8, dy: -3, dr: -2 },
    { clip: 'polygon(32% 44%, 52% 46%, 48% 78%, 28% 74%)', dx: -9, dy: 5, dr: 3 },
    { clip: 'polygon(50% 46%, 68% 44%, 64% 72%, 46% 70%)', dx: 6, dy: -4, dr: -1 },
    { clip: 'polygon(66% 44%, 84% 46%, 80% 76%, 62% 74%)', dx: -5, dy: 2, dr: 1.5 },
    { clip: 'polygon(0 70%, 20% 68%, 16% 100%, 0 100%)', dx: -8, dy: 6, dr: 4 },
  ]

  return (
    <div className="sq-glitch-overlay">
      <div className="sq-glitch-rgb-split" />
      {pf.map((f, i) => (
        <div
          key={`pf-${i}`}
          className="sq-glitch-fragment sq-glitch-particle"
          style={{
            clipPath: f.clip,
            '--dx': `${f.dx}px`,
            '--dy': `${f.dy}px`,
            '--dr': `${f.dr}deg`,
            animationDelay: `${0.04 + i * 0.025}s`,
          } as React.CSSProperties}
        />
      ))}
      {af.map((f, i) => (
        <div
          key={`af-${i}`}
          className="sq-glitch-fragment sq-glitch-png"
          style={{
            clipPath: f.clip,
            '--dx': `${f.dx}px`,
            '--dy': `${f.dy}px`,
            '--dr': `${f.dr}deg`,
            animationDelay: `${0.15 + i * 0.035}s`,
          } as React.CSSProperties}
        />
      ))}
      <div className="sq-glitch-scanlines" />
      <div className="sq-glitch-noise" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════

export default function ShiqikongBridge3D({ bridge, onClose, actionsRef }: Props) {
  const [mode, setMode] = useState<Mode>('png')
  const [scanlinePos, setScanlinePos] = useState(1)
  const [dissolveProgress, setDissolveProgress] = useState(0)
  const [inCompareMode, setInCompareMode] = useState(false)

  // ── 探照灯：鼠标 NDC 坐标 ──
  const mouseNDCRef = useRef(new THREE.Vector2(0, 0))
  const [flashlightEnabled, setFlashlightEnabled] = useState(false)
  const [texturedOnlyOn, setTexturedOnlyOn] = useState(false)

  // 编辑器
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [cameraPos, setCameraPos] = useState(new THREE.Vector3(1.26, -0.14, 1.57))
  const [cameraTarget, setCameraTarget] = useState(new THREE.Vector3(-0.56, 0.01, 0.77))

  // ── 校准参数 ──
  // PNG 层（CSS transform）
  const [pngX, setPngX] = useState(0)
  const [pngY, setPngY] = useState(0)
  const [pngScale, setPngScale] = useState(1)
  const [pngRotation, setPngRotation] = useState(0)

  // 贴图模型层
  const [modelPx, setModelPx] = useState(-1.55); const [modelPy, setModelPy] = useState(0.01); const [modelPz, setModelPz] = useState(-0.31)
  const [modelRx, setModelRx] = useState(0); const [modelRy, setModelRy] = useState(0); const [modelRz, setModelRz] = useState(0)
  const [modelScale, setModelScale] = useState(1.23)

  // 粒子层
  const [partPx, setPartPx] = useState(-1.55); const [partPy, setPartPy] = useState(0.01); const [partPz, setPartPz] = useState(-0.31)
  const [partRx, setPartRx] = useState(0); const [partRy, setPartRy] = useState(0); const [partRz, setPartRz] = useState(0)
  const [partScale, setPartScale] = useState(1.23)
  const [partOpacity, setPartOpacity] = useState(0.38)

  // 粒子拖拽后自动旋转
  const [hasDraggedParticle, setHasDraggedParticle] = useState(false)

  // 态A hover：悬停桥PNG时切换背景图
  const [isHoveringPNG, setIsHoveringPNG] = useState(false)

  // ── 桥PNG 像素级 hover 检测：加载图片到离屏 Canvas 采样 Alpha ──
  const bridgeAlphaRef = useRef<Uint8ClampedArray | null>(null)
  const bridgeImgWHRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = 'images/shiqikong-bridge.webp'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      bridgeAlphaRef.current = data.data // RGBA 数组
      bridgeImgWHRef.current = { w: c.width, h: c.height }
    }
  }, [])

  const handleModelChange = useCallback((pos: [number, number, number], rot: [number, number, number], scale: number) => {
    setModelPx(pos[0]); setModelPy(pos[1]); setModelPz(pos[2])
    setModelRx(rot[0]); setModelRy(rot[1]); setModelRz(rot[2])
    setModelScale(scale)
  }, [])

  const handlePartChange = useCallback((pos: [number, number, number], rot: [number, number, number], scale: number) => {
    setPartPx(pos[0]); setPartPy(pos[1]); setPartPz(pos[2])
    setPartRx(rot[0]); setPartRy(rot[1]); setPartRz(rot[2])
    setPartScale(scale)
  }, [])

  // OrbitControls 拖拽结束后触发自动旋转
  const handleOrbitDragEnd = useCallback(() => {
    setHasDraggedParticle(true)
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const isMouseDown = useRef(false)
  const mouseDownAt = useRef({ x: 0, y: 0 })
  const animRef = useRef(0)

  // 清理
  useEffect(() => () => { cancelAnimationFrame(animRef.current) }, [])

  // 键盘：Cmd+Shift+E 编辑器
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 'e') {
        e.preventDefault()
        setEditorOpen(v => !v)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  // ═══ A→C：扫描线跟随光标揭示粒子 ═══
  const startScanline = useCallback(() => {
    setMode('scanline-in')
    setScanlinePos(0.33)
  }, [])

  // ═══ 消散动画 ═══
  const startDissolve = useCallback(() => {
    setMode('dissolving')
    setDissolveProgress(0)
    const start = performance.now()
    const dur = 1500
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2
      setDissolveProgress(e)
      if (p < 1) animRef.current = requestAnimationFrame(tick)
      else { setDissolveProgress(1); setInCompareMode(true); setMode('compare') }
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  // ═══ 确认 → 态C ═══
  const confirmParticle = useCallback(() => { setInCompareMode(false); setMode('particle') }, [])

  // ═══ 闪电 → 纯贴图模型 ═══
  const toggleTexturedOnly = useCallback(() => { setTexturedOnlyOn(v => !v); setFlashlightEnabled(false) }, [])
  const onGlitchDone = useCallback(() => {
    setMode('png'); setScanlinePos(0); setDissolveProgress(0); setInCompareMode(false)
  }, [])

  // ── 暴露控制方法给父组件（关键词行图标按钮）──
  useEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        toggleFlashlight: () => setFlashlightEnabled(v => !v),
        triggerGlitch: toggleTexturedOnly,
        isFlashlightOn: flashlightEnabled,
        currentMode: mode,
      }
    }
  }, [actionsRef, flashlightEnabled, mode, toggleTexturedOnly])

  // ═══ 输入处理 ═══
  const canInteract = mode === 'particle'

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isMouseDown.current = true
    mouseDownAt.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    // ── png 模式：像素级检测 —— 只在桥PNG非透明像素上才发光 ──
    if (mode === 'png' && !calibrateMode && containerRef.current && bridgeAlphaRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const W = r.width
      const H = r.height
      const Iw = bridgeImgWHRef.current.w
      const Ih = bridgeImgWHRef.current.h
      if (Iw === 0 || Ih === 0) { setIsHoveringPNG(false); return }
      // background-size: cover 逆映射
      const scale = Math.max(W / Iw, H / Ih)
      const Sw = Iw * scale
      const Sh = Ih * scale
      const dx = (W - Sw) / 2
      const dy = (H - Sh) / 2
      const ix = Math.floor((mx - dx) / scale)
      const iy = Math.floor((my - dy) / scale)
      if (ix >= 0 && ix < Iw && iy >= 0 && iy < Ih) {
        const alpha = bridgeAlphaRef.current[(iy * Iw + ix) * 4 + 3]
        setIsHoveringPNG(alpha > 20) // 阈值 20 避免边缘半透明误触发
      } else {
        setIsHoveringPNG(false)
      }
    }

    // ── 扫描线模式：跟随光标 Y 逐步揭示 ──
    if (mode === 'scanline-in' && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      const pos = Math.max(0.02, Math.min(1, (e.clientY - r.top) / r.height))
      setScanlinePos(pos)
      if (pos > 0.94) {
        setScanlinePos(1)
        setMode('particle')
      }
      return
    }

    // ── 粒子模式：探照灯跟随光标（Cmd 旋转时暂停更新，避免抖动） ──
    if (flashlightEnabled && mode === 'particle' && !e.metaKey && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2
      mouseNDCRef.current.set(nx, ny)
    }

    // ── 对比模式滑块 ──
    if (inCompareMode && !isMouseDown.current && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      setScanlinePos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
    }
  }, [mode, flashlightEnabled, inCompareMode, calibrateMode])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown.current) return
    isMouseDown.current = false
    if (calibrateMode) return
    // Cmd 拖拽不触发点击
    if (e.metaKey) return
    const dx = e.clientX - mouseDownAt.current.x
    const dy = e.clientY - mouseDownAt.current.y
    if (Math.sqrt(dx * dx + dy * dy) <= 5) {
      if (mode === 'scanline-in') {
        // 扫描线期间点击任意处 → 完成扫描进入粒子模式
        setScanlinePos(1)
        setMode('particle')
      } else if (mode === 'png') {
        startScanline()
      }
      // 粒子模式点击不再触发返回，用底部闪电按钮
    }
  }, [mode, calibrateMode, startScanline])

  // 点击切换
  const handlePngClick = useCallback((e: React.MouseEvent) => {
    if (calibrateMode || e.metaKey) return
    if (mode === 'png') startScanline()
  }, [mode, calibrateMode, startScanline])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (calibrateMode || !canInteract || e.metaKey) return
    // 粒子模式不响应 Canvas 点击，用底部闪电按钮切换
  }, [mode, calibrateMode, canInteract])

  // ═══ 可见性 ═══
  // 闪电：在粒子模式下切换为纯贴图模型
  const showTextured = (calibrateMode && mode !== 'glitching') || (!calibrateMode && mode === 'particle' && texturedOnlyOn)
  const showParticle = calibrateMode || mode === 'scanline-in' || (mode === 'particle' && !texturedOnlyOn)
  const isFlashlight = !calibrateMode && mode === 'particle' && flashlightEnabled

  const texturedOpacity =
    calibrateMode ? 1 :
    mode === 'dissolving' ? 1 - dissolveProgress :
    mode === 'compare' ? 0.25 :
    1
  const particleOpacity =
    calibrateMode ? partOpacity :
    mode === 'dissolving' ? dissolveProgress :
    mode === 'compare' || mode === 'particle' || mode === 'scanline-in' ? 0.38 :
    0

  // 提示
  const hints: Record<Mode, string> = {
    'png': '点击化为粒子',
    'scanline-in': '',
    'textured': '',
    'dissolving': '',
    'compare': '',
    'particle': '拖拽旋转平移 · Cmd暂停探照灯 · 底部按钮控制',
    'glitching': '',
  }

  // 背景图切换：态A(png)默认显示初始背景图（含桥），hover 桥PNG时 smooth crossfade 到无桥背景图
  const showInitialBg = mode === 'png' && !isHoveringPNG

  // CRT 扫描线 clip-path: inset(top right bottom left)
  // 扫描线从上往下移动，已扫区域（上面）显示 Canvas，未扫区（下面）显示 PNG
  // Canvas 初始用 clip 全隐藏，逐步从上显示
  const scanlineClip = mode === 'scanline-in'
    ? `inset(0 0 ${100 - scanlinePos * 100}% 0)`
    : 'inset(0 0 0 0)'

  return (
    <div
        className="sq-container"
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { if (mode === 'png' && !calibrateMode) setIsHoveringPNG(false) }}
      >
      {/* Layer 0b: 无桥背景图 — 始终全显在底层，上层淡出时无缝露出 */}
      <div
        className="sq-bg-layer sq-bg-no-bridge"
        style={{ opacity: 1 } as React.CSSProperties}
      />
      {/* Layer 0a: 初始背景图（含桥）— 叠在无桥图上，态A默认显示，hover时淡出露出下层 */}
      <div
        className="sq-bg-layer sq-bg-initial"
        style={{
          opacity: showInitialBg ? 1 : 0,
          zIndex: 1, // 确保在上层
        } as React.CSSProperties}
      />

      {/* Layer 1: PNG — 态A / 扫描线期 显示；校准模式半透明覆盖 */}
      {mode !== 'glitching' && (
        <div
          className={`sq-png-layer${mode === 'png' || mode === 'scanline-in' ? '' : ' sq-png-hidden'}`}
          style={calibrateMode ? {
            opacity: 0.45,
            pointerEvents: 'none',
            transform: `translate(${pngX}%, ${pngY}%) scale(${pngScale}) rotate(${pngRotation}deg)`,
          } as React.CSSProperties : mode === 'scanline-in' ? {
            clipPath: `inset(${scanlinePos * 100}% 0 0 0)`,
          } as React.CSSProperties : isHoveringPNG ? {
            filter: 'brightness(1.15) drop-shadow(0 0 12px rgba(255,220,140,0.55)) drop-shadow(0 0 28px rgba(212,175,55,0.35))',
          } as React.CSSProperties : undefined}
          onMouseDown={mode === 'png' && !calibrateMode ? onMouseDown : undefined}
          onMouseUp={mode === 'png' && !calibrateMode ? onMouseUp : undefined}
          onClick={mode === 'png' && !calibrateMode ? (e) => handlePngClick(e) : undefined}
          onMouseEnter={mode === 'png' && !calibrateMode ? () => setIsHoveringPNG(true) : undefined}
          onMouseLeave={mode === 'png' && !calibrateMode ? () => setIsHoveringPNG(false) : undefined}
        />
      )}

      {/* Layer 2: Canvas — 始终渲染预初始化WebGL，png模式下opacity:0隐藏避免闪黑 */}
      <div
        className="sq-canvas-layer"
        style={{
          opacity: (mode === 'png' && !calibrateMode && !editorOpen) ? 0 : 1,
          pointerEvents: (mode === 'png' && !calibrateMode && !editorOpen) ? 'none' : 'auto',
          clipPath: mode === 'scanline-in' ? scanlineClip : undefined,
          transition: 'none',
        } as React.CSSProperties}
        onMouseDown={canInteract ? onMouseDown : undefined}
        onMouseUp={canInteract ? onMouseUp : undefined}
      >
        <Canvas
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          camera={{ position: [1.26, -0.14, 1.57], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, localClippingEnabled: true, toneMapping: THREE.NoToneMapping }}
        >
          <ThreeScene
            mode={mode}
            dissolveProgress={dissolveProgress}
            texturedOpacity={texturedOpacity}
            particleOpacity={particleOpacity}
            showTextured={showTextured}
            showParticle={showParticle}
            onCameraChange={(pos, target) => { setCameraPos(pos); setCameraTarget(target) }}
            calibrateMode={calibrateMode}
            modelPos={[modelPx, modelPy, modelPz]}
            modelRot={[modelRx, modelRy, modelRz]}
            modelScale={modelScale}
            partPos={[partPx, partPy, partPz]}
            partRot={[partRx, partRy, partRz]}
            partScale={partScale}
            onModelChange={handleModelChange}
            onPartChange={handlePartChange}
            onPartDragEnd={() => setHasDraggedParticle(true)}
            mouseNDCRef={mouseNDCRef}
            isFlashlight={isFlashlight}
            autoRotate={hasDraggedParticle && !calibrateMode}
            onOrbitDragEnd={handleOrbitDragEnd}
          />
        </Canvas>
      </div>

      {/* Layer 3: 扫描线 */}
      <ScanlineBar
        position={mode === 'scanline-in' ? scanlinePos : (inCompareMode ? scanlinePos : 0)}
        visible={mode === 'scanline-in' || inCompareMode}
      />

      {/* Layer 3b: 对比标签 */}
      {inCompareMode && (
        <>
          <div className="sq-compare-label sq-compare-label-left">贴图</div>
          <div className="sq-compare-label sq-compare-label-right">粒子</div>
        </>
      )}

      {/* Layer 4: Glitch */}
      <GlitchOverlay active={mode === 'glitching'} onComplete={onGlitchDone} />

      {/* Layer 5: 提示 — 已移除 */}

      {/* Layer 6: 编辑器 */}
      {editorOpen && (
        <div className={`sq-editor-panel${editorExpanded ? ' sq-editor-expanded' : ''}`} onClick={e => e.stopPropagation()}>
          {/* 折叠态：标题栏 + 展开按钮 + 校准开关 */}
          <div className="sq-editor-header">
            <div className="sq-editor-title-compact">
              三态校准编辑器
              <span className="sq-editor-toggle-btn" onClick={() => setEditorExpanded(!editorExpanded)}>
                {editorExpanded ? '▼ 收起' : '▲ 展开'}
              </span>
            </div>
            <label className="sq-editor-check sq-editor-check-inline">
              <input type="checkbox" checked={calibrateMode} onChange={e => setCalibrateMode(e.target.checked)} />
              <span>三态同显</span>
            </label>
          </div>

          {/* 展开态：完整参数面板 */}
          {editorExpanded && (
            <>
              {calibrateMode && (
                <div className="sq-editor-hint" style={{ marginBottom: 8 }}>
                  调整各层参数 → 复制定位信息给我
                </div>
              )}

              {/* ═══ 态A PNG ═══ */}
              <div className="sq-editor-section">
                <div className="sq-editor-section-title">态A — PNG图片层</div>
                <div className="sq-editor-grid">
                  <CalibInput label="translateX(%)" value={pngX} onChange={setPngX} step={0.5} />
                  <CalibInput label="translateY(%)" value={pngY} onChange={setPngY} step={0.5} />
                  <CalibInput label="scale" value={pngScale} onChange={setPngScale} step={0.01} />
                  <CalibInput label="rotation(deg)" value={pngRotation} onChange={setPngRotation} step={0.5} />
                </div>
                <button className="sq-editor-copy" onClick={() => {
                  navigator.clipboard.writeText(
                    `PNG: { x: ${pngX}, y: ${pngY}, scale: ${pngScale}, rotation: ${pngRotation} }`
                  )
                }}>复制 PNG 参数</button>
              </div>

              {/* ═══ 态B 贴图模型 ═══ */}
              <div className="sq-editor-section">
                <div className="sq-editor-section-title">态B — 贴图3D模型</div>
                <div className="sq-editor-grid">
                  <CalibInput label="posX" value={modelPx} onChange={setModelPx} step={0.05} />
                  <CalibInput label="posY" value={modelPy} onChange={setModelPy} step={0.05} />
                  <CalibInput label="posZ" value={modelPz} onChange={setModelPz} step={0.05} />
                  <CalibInput label="rotX" value={modelRx} onChange={setModelRx} step={0.05} />
                  <CalibInput label="rotY" value={modelRy} onChange={setModelRy} step={0.05} />
                  <CalibInput label="rotZ" value={modelRz} onChange={setModelRz} step={0.05} />
                  <CalibInput label="scale" value={modelScale} onChange={setModelScale} step={0.01} />
                </div>
                <button className="sq-editor-copy" onClick={() => {
                  navigator.clipboard.writeText(
                    `模型: { pos: [${modelPx.toFixed(2)}, ${modelPy.toFixed(2)}, ${modelPz.toFixed(2)}], rot: [${modelRx.toFixed(2)}, ${modelRy.toFixed(2)}, ${modelRz.toFixed(2)}], scale: ${modelScale.toFixed(2)} }`
                  )
                }}>复制 模型 参数</button>
              </div>

              {/* ═══ 态C 粒子 ═══ */}
              <div className="sq-editor-section">
                <div className="sq-editor-section-title">态C — 粒子云</div>
                <div className="sq-editor-grid">
                  <CalibInput label="posX" value={partPx} onChange={setPartPx} step={0.05} />
                  <CalibInput label="posY" value={partPy} onChange={setPartPy} step={0.05} />
                  <CalibInput label="posZ" value={partPz} onChange={setPartPz} step={0.05} />
                  <CalibInput label="rotX" value={partRx} onChange={setPartRx} step={0.05} />
                  <CalibInput label="rotY" value={partRy} onChange={setPartRy} step={0.05} />
                  <CalibInput label="rotZ" value={partRz} onChange={setPartRz} step={0.05} />
                  <CalibInput label="scale" value={partScale} onChange={setPartScale} step={0.01} />
                  <CalibInput label="opacity" value={partOpacity} onChange={setPartOpacity} step={0.02} />
                </div>
                <button className="sq-editor-copy" onClick={() => {
                  navigator.clipboard.writeText(
                    `粒子: { pos: [${partPx.toFixed(2)}, ${partPy.toFixed(2)}, ${partPz.toFixed(2)}], rot: [${partRx.toFixed(2)}, ${partRy.toFixed(2)}, ${partRz.toFixed(2)}], scale: ${partScale.toFixed(2)}, opacity: ${partOpacity.toFixed(2)} }`
                  )
                }}>复制 粒子 参数</button>
              </div>

              {/* ═══ 相机 ═══ */}
              <div className="sq-editor-section">
                <div className="sq-editor-section-title">相机</div>
                <div className="sq-editor-row">
                  <span className="sq-editor-label">Position:</span>
                  <span className="sq-editor-value">
                    [{cameraPos.x.toFixed(2)}, {cameraPos.y.toFixed(2)}, {cameraPos.z.toFixed(2)}]
                  </span>
                </div>
                <div className="sq-editor-row">
                  <span className="sq-editor-label">Target:</span>
                  <span className="sq-editor-value">
                    [{cameraTarget.x.toFixed(2)}, {cameraTarget.y.toFixed(2)}, {cameraTarget.z.toFixed(2)}]
                  </span>
                </div>
                <button className="sq-editor-copy" onClick={() => {
                  navigator.clipboard.writeText(
                    `相机: { position: [${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)}], target: [${cameraTarget.x.toFixed(2)}, ${cameraTarget.y.toFixed(2)}, ${cameraTarget.z.toFixed(2)}] }`
                  )
                }}>复制 相机 参数</button>
              </div>

              <div className="sq-editor-hint" style={{ marginTop: 8 }}>
                Cmd+Shift+E 关闭 · 拖拽3D模型调角度
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
