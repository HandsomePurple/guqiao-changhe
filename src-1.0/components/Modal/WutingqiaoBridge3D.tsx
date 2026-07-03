import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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
// 常量 — 五亭桥
// ═══════════════════════════════════════════════════════════

const OBJ_DIR = 'models/五亭桥带贴图模型-新2/'
const OBJ_NAME = '五亭桥模型.obj'
const MTL_NAME = 'Meshy_AI_Pavilion_Bridge_0630074245_texture.mtl'

const BASE_STEP = 8
const BRIDGE_SPAN = 2
const FLATTEN_Y = 0.75 // Y轴压扁系数，匹配桥PNG图片比例
const SHADER_VERSION = 8 // 递增此版本号可强制重建所有 ShaderMaterial 缓存

// 背景图片路径（通过 inline style 覆盖 sq-* CSS 中的 image）
const BG_INITIAL = 'url(images/五亭桥粒子模型初始背景图.webp)'
const BG_NO_BRIDGE = 'url(images/五亭桥粒子模型无桥背景图.webp)'
const BG_PNG = 'url(images/五亭桥-桥抠图.webp)'
const PNG_SRC = 'images/五亭桥-桥抠图.webp'

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

const DEFAULT_TARGET = new THREE.Vector3(-0.18, 0.07, -0.07)
const DEFAULT_CAMERA: [number, number, number] = [0.19, -0.11, 3.23]

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

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate
    }
    autoRotateRef.current = autoRotate
  }, [autoRotate])

  useEffect(() => {
    const ctrl = controlsRef.current
    if (!ctrl) return
    const handleEnd = () => {
      if (!ctrl.autoRotate && onOrbitDragEnd) onOrbitDragEnd()
    }
    ctrl.addEventListener('end', handleEnd)
    return () => ctrl.removeEventListener('end', handleEnd)
  }, [onOrbitDragEnd])

  useFrame(() => {
    if (controlsRef.current) {
      const ctrl = controlsRef.current
      if (ctrl.autoRotate !== autoRotateRef.current) {
        ctrl.autoRotate = autoRotateRef.current
      }
      onCameraChange(camera.position.clone(), (ctrl.target as THREE.Vector3).clone())
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
// 共享 BridgeTransform — 统一 bbox → scale/center
// ═══════════════════════════════════════════════════════════

interface BridgeTransform {
  minY: number
  maxY: number
  scale: number
  cx: number
  cy: number
  cz: number
}

const DEFAULT_TRANSFORM: BridgeTransform = { minY: -2, maxY: 2, scale: 1, cx: 0, cy: 0, cz: 0 }

function computeBridgeTransform(obj: THREE.Group): BridgeTransform {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  obj.traverse((child) => {
    const anyChild = child as any
    if (anyChild.isMesh || anyChild.isLine || anyChild.isLineSegments || anyChild.isPoints) {
      const geo = anyChild.geometry
      geo.computeBoundingBox()
      if (geo.boundingBox) {
        child.updateWorldMatrix(true, false)
        const bb = geo.boundingBox
        const corners = [
          new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
          new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
          new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
          new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
          new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
          new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
          new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
          new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
        ]
        for (const c of corners) {
          c.applyMatrix4(child.matrixWorld)
          minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x)
          minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y)
          minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z)
        }
      }
    }
  })
  if (minY === Infinity) return DEFAULT_TRANSFORM
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const maxSize = Math.max(maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1)
  const scale = BRIDGE_SPAN / maxSize
  return { minY, maxY, scale, cx, cy, cz }
}

function useBridgeTransform(obj: THREE.Group | null): BridgeTransform {
  return useMemo(() => {
    if (!obj) return DEFAULT_TRANSFORM
    return computeBridgeTransform(obj)
  }, [obj])
}

// ═══════════════════════════════════════════════════════════
// TexturedModel — MTLLoader + OBJLoader 贴图实体
// ═══════════════════════════════════════════════════════════

function TexturedModel({
  transform,
  opacity,
  dissolveProgress,
  visible,
  sharedObj,
}: {
  transform: BridgeTransform
  opacity: number
  dissolveProgress: number
  visible: boolean
  sharedObj: THREE.Group | null
}) {
  const groupRef = useRef<THREE.Group>(null)
  const obj = useMemo(() => sharedObj?.clone(true) ?? null, [sharedObj])

  useFrame(() => {
    if (!obj) return
    const { minY, maxY } = transform

    obj.traverse((child) => {
      const anyChild = child as any
      const isRenderable = anyChild.isMesh || anyChild.isLine || anyChild.isLineSegments || anyChild.isPoints
      if (!isRenderable) return

      const mats = Array.isArray(anyChild.material) ? anyChild.material : [anyChild.material]
      mats.forEach((m: any) => {
        if (m) {
          m.transparent = true
          m.opacity = opacity
          if (m.depthWrite !== undefined) m.depthWrite = opacity > 0.9

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
// 探照灯着色器
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
uniform float uAspect;

void main() {
  vec2 ndc = vClipPos.xy / vClipPos.w;

  // ★ Aspect 修正：乘以 aspect 使 X 轴距离与 Y 轴等效 → 正圆形
  vec2 correctedNdc = vec2(ndc.x * uAspect, ndc.y);
  vec2 correctedMouse = vec2(uMouseNDC.x * uAspect, uMouseNDC.y);
  float dist = distance(correctedNdc, correctedMouse);

  // ★ 超柔羽化：smoothstep 原生 S 曲线（不用 pow 避免末端陡峭）
  float mask = 1.0 - smoothstep(uRadius - uFeather, uRadius + uFeather * 0.6, dist);

  vec4 texColor = texture2D(uMap, vUv);
  float glow = 1.0 + mask * 0.25;
  float finalAlpha = max(texColor.a * mask, mask * 0.85);
  // discard 透明像素，防止它们写入 stencil buffer 污染光斑外区域
  if (finalAlpha < 0.008) discard;
  gl_FragColor = vec4(texColor.rgb * glow, finalAlpha);
}
`

// ═══════════════════════════════════════════════════════════
// FlashlightModel
// ═══════════════════════════════════════════════════════════

function FlashlightModel({
  transform,
  mouseNDCRef,
  visible,
  sharedObj,
}: {
  transform: BridgeTransform
  mouseNDCRef: React.MutableRefObject<THREE.Vector2>
  visible: boolean
  sharedObj: THREE.Group | null
}) {
  const groupRef = useRef<THREE.Group>(null)
  const matRefs = useRef<THREE.ShaderMaterial[]>([])
  const { size } = useThree()
  const obj = useMemo(() => sharedObj?.clone(true) ?? null, [sharedObj])

  useEffect(() => {
    if (!obj) return

    const newMats: THREE.ShaderMaterial[] = []
    obj.traverse((child) => {
      const anyChild = child as any
      if (anyChild.isMesh) {
        const mesh = anyChild as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const replacementMats: THREE.ShaderMaterial[] = []

        mats.forEach((oldMat) => {
          if (!oldMat) return
          const map = (oldMat as any).map || null
          // 🔍 手电筒模式诊断
          console.log(`[五亭桥FL] matType=${oldMat.type} hasMap=!!${!!map} mapImage=${map?.image ? 'EXISTS(' + map.image.width + 'x' + map.image.height + ')' : 'NULL'} color=${(oldMat as any).color?.getHexString?.() || '?'} name=${oldMat.name}`)
          const shaderMat = new THREE.ShaderMaterial({
            uniforms: {
              uMap: { value: map },
              uMouseNDC: { value: new THREE.Vector2(0, 0) },
              uRadius: { value: 0.22 },
              uFeather: { value: 0.55 },
              uAspect: { value: size.width / Math.max(size.height, 1) },
            },
            vertexShader: FLASHLIGHT_VERTEX,
            fragmentShader: FLASHLIGHT_FRAGMENT,
            transparent: true,
            depthWrite: false,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilFail: THREE.ReplaceStencilOp,
            stencilZFail: THREE.ReplaceStencilOp,
            stencilZPass: THREE.ReplaceStencilOp,
          })
          replacementMats.push(shaderMat)
          newMats.push(shaderMat)
        })

        mesh.renderOrder = 1
        if (replacementMats.length === 1) {
          mesh.material = replacementMats[0]
        } else {
          mesh.material = replacementMats
        }
      }
    })
    matRefs.current = newMats
  }, [obj, SHADER_VERSION])

  useFrame(() => {
    const aspect = size.width / Math.max(size.height, 1)
    for (const mat of matRefs.current) {
      if (mat.uniforms) {
        mat.uniforms.uMouseNDC.value.copy(mouseNDCRef.current)
        mat.uniforms.uAspect.value = aspect
      }
    }
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
// ParticleCloud — OBJ 顶点 → 粒子
// ═══════════════════════════════════════════════════════════

function ParticleCloud({
  transform,
  visible,
  mouseNDCRef,
  isFlashlight,
  sharedObj,
}: {
  transform: BridgeTransform
  visible: boolean
  mouseNDCRef: React.MutableRefObject<THREE.Vector2>
  isFlashlight: boolean
  sharedObj: THREE.Group | null
}) {
  const obj = useMemo(() => sharedObj?.clone(true) ?? null, [sharedObj])

  const { positions, colors } = useMemo(() => {
    console.log('[五亭桥粒子] useMemo start, obj:', !!obj)
    if (!obj) return { positions: new Float32Array(0), colors: new Float32Array(0) }

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
    console.log('[五亭桥粒子] totalVerts:', totalVerts, 'meshes:', meshCount, 'Y范围:', preMinY.toFixed(3), '~', preMaxY.toFixed(3))

    // 结构感知密度
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
            keepProb = 0.38
          } else if (ny > 0.3) {
            keepProb = 0.65
          } else {
            keepProb = 1.0
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

    console.log('[五亭桥粒子] rawPositions.length:', rawPositions.length)
    if (rawPositions.length === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    const count = rawPositions.length / 3
    // 计算局部 Y/Z 范围用于颜色映射
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < count; i++) {
      const y = rawPositions[i * 3 + 1]
      const z = rawPositions[i * 3 + 2]
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }

    // 使用共享 transform 进行归一化
    const { scale, cx, cy, cz } = transform
    const allPositions = new Float32Array(rawPositions.length)
    for (let i = 0; i < count; i++) {
      allPositions[i * 3]     = (rawPositions[i * 3]     - cx) * scale
      allPositions[i * 3 + 1] = (rawPositions[i * 3 + 1] - cy) * scale
      allPositions[i * 3 + 2] = (rawPositions[i * 3 + 2] - cz) * scale
    }

    // Y轴(上中下) × Z轴(前中后) = 9区色彩矩阵（使用局部范围）
    const yRange = maxY - minY || 0.001
    const zRange = maxZ - minZ || 0.001
    const col = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const rawY = rawPositions[i * 3 + 1]
      const rawZ = rawPositions[i * 3 + 2]
      const normalizedY = (rawY - minY) / yRange
      const normalizedZ = (rawZ - minZ) / zRange

      let r: number, g: number, b: number

      // Y轴分层着色 — 暖白色系，微弱层次
      if (normalizedY > 0.6) {
        const t = (normalizedY - 0.6) / 0.4
        r = 0.88 + t * 0.08
        g = 0.86 + t * 0.08
        b = 0.82 + t * 0.10
      } else if (normalizedY > 0.3) {
        const t = (normalizedY - 0.3) / 0.3
        r = 0.92 + t * 0.04
        g = 0.90 + t * 0.04
        b = 0.87 + t * 0.06
      } else {
        const t = normalizedY / 0.3
        r = 0.95 + t * 0.05
        g = 0.94 + t * 0.04
        b = 0.92 + t * 0.06
      }

      let zFactor: number
      if (normalizedZ > 0.66) {
        zFactor = 1.0
      } else if (normalizedZ > 0.33) {
        const t = (normalizedZ - 0.33) / 0.33
        zFactor = 0.78 + t * 0.22
      } else {
        const t = normalizedZ / 0.33
        zFactor = 0.62 + t * 0.16
      }

      r *= zFactor
      g *= zFactor
      b *= zFactor

      const noise = (Math.random() - 0.5) * 0.04
      col[i * 3]     = Math.min(1, r + noise)
      col[i * 3 + 1] = Math.min(1, g + noise)
      col[i * 3 + 2] = Math.min(1, b + noise)
    }

    console.log('[五亭桥粒子] 粒子数:', count, 'sharedScale:', scale.toFixed(3))
    return { positions: allPositions, colors: col }
  }, [obj, transform])

  // ── ShaderMaterial + Stencil 遮罩 + 软边缘淡出 ──
  const { size: pcSize } = useThree()
  const pointsMat = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.42 },
        uMouseNDC: { value: new THREE.Vector2(0, 0) },
        uLightRadius: { value: 0.22 },
        uLightFeather: { value: 0.50 },
        uAspect: { value: 1.0 },
        uFlashlightActive: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        varying vec3 vColor;
        varying vec4 vClipPos;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 0.042 * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
          vClipPos = gl_Position;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying vec4 vClipPos;
        uniform float uOpacity;
        uniform vec2 uMouseNDC;
        uniform float uLightRadius;
        uniform float uLightFeather;
        uniform float uAspect;
        uniform float uFlashlightActive;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float circle = 1.0 - smoothstep(0.0, 0.5, d);

          vec2 ndc = vClipPos.xy / vClipPos.w;
          vec2 correctedNdc = vec2(ndc.x * uAspect, ndc.y);
          vec2 correctedMouse = vec2(uMouseNDC.x * uAspect, uMouseNDC.y);
          float distToLight = distance(correctedNdc, correctedMouse);

          // ★ 仅手电筒激活时光斑内丢弃粒子
          float alpha = circle * uOpacity;
          if (uFlashlightActive > 0.5) {
            if (distToLight <= uLightRadius) discard;
            float edgeFade = smoothstep(uLightRadius, uLightRadius + uLightFeather, distToLight);
            alpha *= edgeFade;
          }
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
    return mat
  }, [obj, SHADER_VERSION])

  // 每帧同步 mouse + aspect + flashlight
  useFrame(() => {
    if (!pointsMat.uniforms) return
    pointsMat.uniforms.uMouseNDC.value.copy(mouseNDCRef.current)
    pointsMat.uniforms.uAspect.value = pcSize.width / Math.max(pcSize.height, 1)
    pointsMat.uniforms.uFlashlightActive.value = isFlashlight ? 1 : 0
  })

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
      <primitive object={pointsMat} attach="material" />
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

  // 共享 MTL+OBJ — 仅加载一次，各子组件 .clone() 独立使用
  const [sharedObj, setSharedObj] = useState<THREE.Group | null>(null)
  useEffect(() => {
    // 标准 MTLLoader + OBJLoader 串行加载（和十七孔桥一致）
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath(OBJ_DIR)
    mtlLoader.setResourcePath(OBJ_DIR)
    mtlLoader.load(MTL_NAME, (materials) => {
      console.log(`[五亭桥] MTL成功! 材质:`, Object.keys(materials.materials))
      materials.preload()

      // 材质预处理
      Object.values(materials.materials).forEach((m: any) => {
        if (m) {
          m.emissive?.set?.(0x000000)
          if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true }
          m.needsUpdate = true
        }
      })

      const objLoader = new OBJLoader()
      objLoader.setPath(OBJ_DIR)
      objLoader.setMaterials(materials)
      objLoader.load(OBJ_NAME, (obj) => {
        // ★ 清除 LineSegments 残留（7条l行导致OBJLoader误生成）
        let removedCount = 0
        obj.traverse((child: any) => {
          if (child.isLineSegments || child.isLine) {
            console.log(`[五亭桥] ⚠️ 移除LineSegments: type=${child.type}`)
            if (child.parent) child.parent.remove(child)
            removedCount++
          }
          if (child.material && child.material.map) {
            console.log(`[五亭桥] ✅ Mesh: type=${child.type} mat=${child.material.type} map=LOADED(${child.material.map.image?.width}x${child.material.map.image?.height})`)
          }
        })
        if (removedCount > 0) console.log(`[五亭桥] 已清除 ${removedCount} 个LineSegments`)
        setSharedObj(obj)
      }, undefined, (err: Error) => console.error('[五亭桥] OBJ失败:', err))
    }, undefined, (err: Error) => console.error('[五亭桥] MTL失败:', err))
  }, [])
  const bridgeTransform = useBridgeTransform(sharedObj)

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
          position={modelPos}
          rotation={modelRot}
          scale={[modelScale, modelScale * FLATTEN_Y, modelScale]}
          renderOrder={0}
          visible={showTextured}
        >
          <TexturedModel
            transform={bridgeTransform}
            opacity={texturedOpacity}
            dissolveProgress={mode === 'dissolving' ? dissolveProgress : 0}
            visible={showTextured}
            sharedObj={sharedObj}
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
        <group position={modelPos} rotation={modelRot} scale={[modelScale, modelScale * FLATTEN_Y, modelScale]}>
          <FlashlightModel transform={bridgeTransform} mouseNDCRef={mouseNDCRef} visible={isFlashlight} sharedObj={sharedObj} />
        </group>

      {/* 态C — 粒子云（和贴图模型共用 modelPos/modelRot/modelScale） */}
      <group
        ref={partGroupRef}
        position={modelPos}
        rotation={modelRot}
        scale={[modelScale, modelScale * FLATTEN_Y, modelScale]}
        renderOrder={2}
      >
        <ParticleCloud
          transform={bridgeTransform}
          visible={showParticle}
          mouseNDCRef={mouseNDCRef}
          isFlashlight={isFlashlight}
          sharedObj={sharedObj}
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
// ScanlineBar
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
// GlitchOverlay
// ═══════════════════════════════════════════════════════════

function GlitchOverlay({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (active) {
      const t = setTimeout(onComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [active, onComplete])

  if (!active) return null

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
// 主组件 — 五亭桥三态交互系统
// ═══════════════════════════════════════════════════════════

export default function WutingqiaoBridge3D({ bridge, onClose, actionsRef }: Props) {
  const [mode, setMode] = useState<Mode>('png')
  const [scanlinePos, setScanlinePos] = useState(1)
  const [dissolveProgress, setDissolveProgress] = useState(0)
  const [inCompareMode, setInCompareMode] = useState(false)

  const mouseNDCRef = useRef(new THREE.Vector2(0, 0))
  const [flashlightEnabled, setFlashlightEnabled] = useState(false)
  const [texturedOnlyOn, setTexturedOnlyOn] = useState(false)

  // 编辑器
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [calibrateMode, setCalibrateMode] = useState(false)
  const [cameraPos, setCameraPos] = useState(new THREE.Vector3(0, 0, 5))
  const [cameraTarget, setCameraTarget] = useState(new THREE.Vector3(0, 0, 0))

  // ── 校准参数（待编辑器定位后填入）──
  const [pngX, setPngX] = useState(0)
  const [pngY, setPngY] = useState(0)
  const [pngScale, setPngScale] = useState(1)
  const [pngRotation, setPngRotation] = useState(0)

  const [modelPx, setModelPx] = useState(0.03); const [modelPy, setModelPy] = useState(0.07); const [modelPz, setModelPz] = useState(-0.61)
  const [modelRx, setModelRx] = useState(0); const [modelRy, setModelRy] = useState(0); const [modelRz, setModelRz] = useState(0)
  const [modelScale, setModelScale] = useState(1.13)

  const [partOpacity, setPartOpacity] = useState(0.38)

  const [hasDraggedParticle, setHasDraggedParticle] = useState(false)

  // 态A hover
  const [isHoveringPNG, setIsHoveringPNG] = useState(false)

  // ── 像素级 hover 检测 ──
  const bridgeAlphaRef = useRef<Uint8ClampedArray | null>(null)
  const bridgeImgWHRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = PNG_SRC
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      bridgeAlphaRef.current = data.data
      bridgeImgWHRef.current = { w: c.width, h: c.height }
    }
  }, [])

  const handleModelChange = useCallback((pos: [number, number, number], rot: [number, number, number], scale: number) => {
    setModelPx(pos[0]); setModelPy(pos[1]); setModelPz(pos[2])
    setModelRx(rot[0]); setModelRy(rot[1]); setModelRz(rot[2])
    setModelScale(scale)
  }, [])

  // 粒子拖拽同步写模型参数 → 贴图和粒子联动
  const handlePartChange = useCallback((pos: [number, number, number], rot: [number, number, number], scale: number) => {
    setModelPx(pos[0]); setModelPy(pos[1]); setModelPz(pos[2])
    setModelRx(rot[0]); setModelRy(rot[1]); setModelRz(rot[2])
    setModelScale(scale)
  }, [])

  const handleOrbitDragEnd = useCallback(() => {
    setHasDraggedParticle(true)
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const isMouseDown = useRef(false)
  const mouseDownAt = useRef({ x: 0, y: 0 })
  const animRef = useRef(0)

  useEffect(() => () => { cancelAnimationFrame(animRef.current) }, [])

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

  const startScanline = useCallback(() => {
    setMode('scanline-in')
    setScanlinePos(0.33)
  }, [])

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

  const confirmParticle = useCallback(() => { setInCompareMode(false); setMode('particle') }, [])

  // ═══ 闪电 → 纯贴图模型 ═══
  const toggleTexturedOnly = useCallback(() => { setTexturedOnlyOn(v => !v); setFlashlightEnabled(false) }, [])
  const onGlitchDone = useCallback(() => {
    setMode('png'); setScanlinePos(0); setDissolveProgress(0); setInCompareMode(false)
  }, [])

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

  const canInteract = mode === 'particle'

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isMouseDown.current = true
    mouseDownAt.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (mode === 'png' && !calibrateMode && containerRef.current && bridgeAlphaRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const W = r.width
      const H = r.height
      const Iw = bridgeImgWHRef.current.w
      const Ih = bridgeImgWHRef.current.h
      if (Iw === 0 || Ih === 0) { setIsHoveringPNG(false); return }
      const scale = Math.max(W / Iw, H / Ih)
      const Sw = Iw * scale
      const Sh = Ih * scale
      const dx = (W - Sw) / 2
      const dy = (H - Sh) / 2
      const ix = Math.floor((mx - dx) / scale)
      const iy = Math.floor((my - dy) / scale)
      if (ix >= 0 && ix < Iw && iy >= 0 && iy < Ih) {
        const alpha = bridgeAlphaRef.current[(iy * Iw + ix) * 4 + 3]
        setIsHoveringPNG(alpha > 20)
      } else {
        setIsHoveringPNG(false)
      }
    }

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

    if (flashlightEnabled && mode === 'particle' && !e.metaKey && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2
      mouseNDCRef.current.set(nx, ny)
    }

    if (inCompareMode && !isMouseDown.current && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect()
      setScanlinePos(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
    }
  }, [mode, flashlightEnabled, inCompareMode, calibrateMode])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isMouseDown.current) return
    isMouseDown.current = false
    if (calibrateMode) return
    if (e.metaKey) return
    const dx = e.clientX - mouseDownAt.current.x
    const dy = e.clientY - mouseDownAt.current.y
    if (Math.sqrt(dx * dx + dy * dy) <= 5) {
      if (mode === 'scanline-in') {
        setScanlinePos(1)
        setMode('particle')
      } else if (mode === 'png') {
        startScanline()
      }
    }
  }, [mode, calibrateMode, startScanline])

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

  const hints: Record<Mode, string> = {
    'png': '点击化为粒子',
    'scanline-in': '',
    'textured': '',
    'dissolving': '',
    'compare': '',
    'particle': '拖拽旋转平移 · Cmd暂停探照灯 · 底部按钮控制',
    'glitching': '',
  }

  const showInitialBg = mode === 'png' && !isHoveringPNG

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
      {/* Layer 0b: 无桥背景图 */}
      <div
        className="sq-bg-layer sq-bg-no-bridge"
        style={{ opacity: 1, backgroundImage: BG_NO_BRIDGE } as React.CSSProperties}
      />
      {/* Layer 0a: 初始背景图（含桥）*/}
      <div
        className="sq-bg-layer sq-bg-initial"
        style={{
          opacity: showInitialBg ? 1 : 0,
          zIndex: 1,
          backgroundImage: BG_INITIAL,
        } as React.CSSProperties}
      />

      {/* Layer 0c: 手电筒暗色遮罩 — 压低背景亮度，突出粒子模型 */}
      {isFlashlight && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            background: 'rgba(0, 0, 0, 0.35)',
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Layer 1: PNG */}
      {mode !== 'glitching' && (
        <div
          className={`sq-png-layer${mode === 'png' || mode === 'scanline-in' ? '' : ' sq-png-hidden'}`}
          style={calibrateMode ? {
            opacity: 0.45,
            pointerEvents: 'none',
            transform: `translate(${pngX}%, ${pngY}%) scale(${pngScale}) rotate(${pngRotation}deg)`,
            backgroundImage: BG_PNG,
          } as React.CSSProperties : mode === 'scanline-in' ? {
            clipPath: `inset(${scanlinePos * 100}% 0 0 0)`,
            backgroundImage: BG_PNG,
          } as React.CSSProperties : isHoveringPNG ? {
            filter: 'brightness(1.15) drop-shadow(0 0 12px rgba(255,220,140,0.55)) drop-shadow(0 0 28px rgba(212,175,55,0.35))',
            backgroundImage: BG_PNG,
          } as React.CSSProperties : {
            backgroundImage: BG_PNG,
          } as React.CSSProperties}
          onMouseDown={mode === 'png' && !calibrateMode ? onMouseDown : undefined}
          onMouseUp={mode === 'png' && !calibrateMode ? onMouseUp : undefined}
          onClick={mode === 'png' && !calibrateMode ? (e) => handlePngClick(e) : undefined}
          onMouseEnter={mode === 'png' && !calibrateMode ? () => setIsHoveringPNG(true) : undefined}
          onMouseLeave={mode === 'png' && !calibrateMode ? () => setIsHoveringPNG(false) : undefined}
        />
      )}

      {/* Layer 2: Canvas */}
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
          camera={{ position: DEFAULT_CAMERA, fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, localClippingEnabled: true, stencil: true }}
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

      {/* Layer 6: 编辑器 */}
      {editorOpen && (
        <div className={`sq-editor-panel${editorExpanded ? ' sq-editor-expanded' : ''}`} onClick={e => e.stopPropagation()}>
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

          {editorExpanded && (
            <>
              {calibrateMode && (
                <div className="sq-editor-hint" style={{ marginBottom: 8 }}>
                  调整各层参数 → 复制定位信息给我
                </div>
              )}

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

              <div className="sq-editor-section">
                <div className="sq-editor-section-title">态C — 粒子云</div>
                <div className="sq-editor-grid">
                  <CalibInput label="posX" value={modelPx} onChange={setModelPx} step={0.05} />
                  <CalibInput label="posY" value={modelPy} onChange={setModelPy} step={0.05} />
                  <CalibInput label="posZ" value={modelPz} onChange={setModelPz} step={0.05} />
                  <CalibInput label="rotX" value={modelRx} onChange={setModelRx} step={0.05} />
                  <CalibInput label="rotY" value={modelRy} onChange={setModelRy} step={0.05} />
                  <CalibInput label="rotZ" value={modelRz} onChange={setModelRz} step={0.05} />
                  <CalibInput label="scale" value={modelScale} onChange={setModelScale} step={0.01} />
                  <CalibInput label="opacity" value={partOpacity} onChange={setPartOpacity} step={0.02} />
                </div>
                <div className="sq-editor-hint" style={{ marginBottom: 4, fontSize: 11, color: 'rgba(232,213,176,0.5)' }}>
                  拖拽粒子时贴图模型同步联动
                </div>
                <button className="sq-editor-copy" onClick={() => {
                  navigator.clipboard.writeText(
                    `粒子: { pos: [${modelPx.toFixed(2)}, ${modelPy.toFixed(2)}, ${modelPz.toFixed(2)}], rot: [${modelRx.toFixed(2)}, ${modelRy.toFixed(2)}, ${modelRz.toFixed(2)}], scale: ${modelScale.toFixed(2)}, opacity: ${partOpacity.toFixed(2)} }`
                  )
                }}>复制 粒子 参数</button>
              </div>

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
