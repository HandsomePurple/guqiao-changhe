import { useRef, useMemo, Suspense, useCallback, useState, useEffect } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import type { Bridge } from '../../types/bridge'

// 桥类型 → 粒子颜色（暖金/铜色系）
const BRIDGE_COLORS: Record<string, string> = {
  arch: '#C49A6C',
  beam: '#D3B885',
  suspension: '#E0C888',
  'cable-stayed': '#D8C090',
  covered: '#B8936E',
  floating: '#8CB8C8',
  modern: '#C0B4A0',
}

// ============================================================
// 软粒子着色器 ★ 核心方案
// 单层 ShaderMaterial 替代双层 PointsMaterial
// 每个粒子自带：实心亮核（radius 0~35%）+ 平滑渐变到透明边缘（35%→50%）
// 效果：清晰锐利 + 自然柔和，不需要第二层光晕来凑
// ============================================================
const SOFT_PARTICLE_VERT = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  uniform float uSize;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // 固定像素大小（和 PointsMaterial sizeAttenuation=false 等效）
    // 避免透视公式导致近距离粒子爆大
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const SOFT_PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  uniform float uOpacity;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    // 核心 0~30% 全不透明 → 30%~50% 平滑过渡到透明
    float alpha = 1.0 - smoothstep(0.30, 0.50, r);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha * uOpacity);
  }
`

// ============================================================
// 模型路径映射
// ============================================================
const PLY_MODEL_MAP: Record<string, string> = {
  zhaozhou: 'models/赵州桥.ply',
}

const OBJ_MODEL_MAP: Record<string, string> = {
  shiqikong: 'models/十七孔桥模型.obj',
  wuting: 'models/五亭桥模型.obj',
}

// ============================================================
// OBJ 模型加载器（转粒子，含降采样保护）
// ============================================================
function BridgeObjModel({ bridge }: { bridge: Bridge }) {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Points>(null)
  const objPath = OBJ_MODEL_MAP[bridge.id]
  const color = BRIDGE_COLORS[bridge.type] || '#C49A6C'

  const obj = useLoader(OBJLoader, objPath || '')

  const { positions, colors } = useMemo(() => {
    console.log('[BridgeObjModel] useMemo start for', bridge.id, 'obj:', !!obj)
    if (!obj) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    // 调试：打印 obj 结构（仅五亭桥）
    if (bridge.id === 'wuting') {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[五亭桥] OBJ 根节点:', obj.constructor.name, '名称:', obj.name)
      console.log('[五亭桥] 所有子节点类型统计:')
      const typeCounts: Record<string, number> = {}
      obj.traverse((child) => { typeCounts[child.constructor.name] = (typeCounts[child.constructor.name] || 0) + 1 })
      console.table(typeCounts)
      console.log('[五亭桥] ─ 含几何体的 Mesh 详细列表 ─')
      const meshList: Array<{ name: string; verts: number; type: string }> = []
      obj.traverse((child) => {
        if ((child as any).geometry) {
          const posAttr = (child as any).geometry.getAttribute('position')
          if (posAttr) {
            meshList.push({
              name: child.name || '(unnamed)',
              verts: posAttr.count,
              type: child.constructor.name,
            })
          }
        }
      })
      console.table(meshList)
      console.log('[五亭桥] 含几何体 Mesh 总数:', meshList.length)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }

    // 预遍历：计算 Y 轴范围 + 总顶点数（用于结构感知密度）
    let totalVerts = 0
    let meshCount = 0
    let preMinY = Infinity
    let preMaxY = -Infinity
    obj.traverse((child) => {
      if ((child as any).geometry) {
        const posAttr = (child as any).geometry.getAttribute('position')
        if (posAttr) {
          totalVerts += posAttr.count
          meshCount++
          // 稀疏采样估算 Y 范围
          for (let j = 0; j < posAttr.count; j += 100) {
            const y = posAttr.getY(j)
            if (y < preMinY) preMinY = y
            if (y > preMaxY) preMaxY = y
          }
        }
      }
    })
    const preYRange = preMaxY - preMinY || 0.001

    // 结构感知密度 — 上层密(屋顶) > 中层中(悬梁) > 下层疏(基座)
    // 五亭桥和十七孔桥均采用此策略
    const useStructuralParticles = bridge.id === 'wuting' || bridge.id === 'shiqikong'
    const BASE_STEP = useStructuralParticles ? 4 : Math.max(1, Math.ceil(totalVerts / 50000))
    console.log('[BridgeObjModel]', bridge.id, 'totalVerts:', totalVerts, 'meshes:', meshCount, 'baseStep:', BASE_STEP)

    const rawPositions: number[] = []
    obj.traverse((child) => {
      if ((child as any).geometry) {
        const geo = (child as any).geometry
        const posAttr = geo.getAttribute('position')
        if (posAttr) {
          child.updateWorldMatrix(true, false)
          const matrix = child.matrixWorld
          for (let i = 0; i < posAttr.count; i += BASE_STEP) {
            const rawY = posAttr.getY(i)

            // 结构感知剔除：上层保留最多粒子，下层最少
            if (useStructuralParticles) {
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
            }

            const v = new THREE.Vector3(
              posAttr.getX(i),
              posAttr.getY(i),
              posAttr.getZ(i)
            )
            v.applyMatrix4(matrix)
            rawPositions.push(v.x, v.y, v.z)
          }
        }
      }
    })

    console.log('[BridgeObjModel]', bridge.id, 'rawPositions.length:', rawPositions.length)
    if (rawPositions.length === 0) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    // 归一化缩放：模型坐标通常极小，需缩放到场景可见范围
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
    const sizeX = maxX - minX || 1
    const sizeY = maxY - minY || 1
    const sizeZ = maxZ - minZ || 1
    const maxSize = Math.max(sizeX, sizeY, sizeZ)
    const BRIDGE_SPAN = bridge.id === 'wuting' ? 3.2 : 4
    const scale = BRIDGE_SPAN / maxSize
    console.log('[BridgeObjModel]', bridge.id, 'bbox:', { minX, maxX, minY, maxY, minZ, maxZ, maxSize, scale, cx, cy, cz })

    const allPositions = new Float32Array(rawPositions.length)
    for (let i = 0; i < count; i++) {
      allPositions[i * 3]     = (rawPositions[i * 3]     - cx) * scale
      allPositions[i * 3 + 1] = (rawPositions[i * 3 + 1] - cy) * scale
      allPositions[i * 3 + 2] = (rawPositions[i * 3 + 2] - cz) * scale
    }

    const baseColor = new THREE.Color(color)
    const col = new Float32Array(count * 3)
    const yRange = maxY - minY || 0.001
    const zRange = maxZ - minZ || 0.001

    for (let i = 0; i < count; i++) {
      const rawY = rawPositions[i * 3 + 1]
      const rawZ = rawPositions[i * 3 + 2]
      const normalizedY = (rawY - minY) / yRange // 0(底部) → 1(顶部)
      const normalizedZ = (rawZ - minZ) / zRange // 0(后面) → 1(前面)

      let r: number, g: number, b: number

      if (bridge.id === 'wuting' || bridge.id === 'shiqikong') {
        // ═══════════════════════════════════════════════════════
        // OBJ 粒子桥：Y轴(上中下) × Z轴(前中后) = 9区色彩矩阵
        //
        // Y轴(高度)           Z轴(深度/前后)
        // 上层>60% 屋顶铜色  │  前面>66%  亮度×1.00
        // 中层30-60% 暖黄    │  中间33-66% 亮度×0.72
        // 下层<30%  基座亮金  │  后面<33%  亮度×0.50
        // ═══════════════════════════════════════════════════════
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
      } else {
        // 其他桥保持原方案
        const c = baseColor.clone()
        r = c.r
        g = c.g
        b = c.b
      }

      // 微弱的随机扰动，让粒子保留一点自然感
      const noise = (Math.random() - 0.5) * 0.04
      col[i * 3]     = Math.min(1, r + noise)
      col[i * 3 + 1] = Math.min(1, g + noise)
      col[i * 3 + 2] = Math.min(1, b + noise)
    }

    return { positions: allPositions, colors: col }
  }, [obj, color])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.12) * 0.1
    groupRef.current.position.y = Math.sin(t * 0.3) * 0.06
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.PointsMaterial
      mat.opacity = 0.18 + Math.sin(t * 0.8) * 0.1
    }
  })

  if (positions.length === 0) {
    console.log('[BridgeObjModel] positions empty for', bridge.id, '→ showing fallback sphere')
    return (
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial color="#C9A882" transparent opacity={0.4} wireframe />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.6, 32, 32]} />
          <meshBasicMaterial color="#E8D5B0" transparent opacity={0.15} />
        </mesh>
      </group>
    )
  }

  // 按桥 ID 单独配置渲染模式
  // OBJ粒子桥（五亭桥/十七孔桥）：单层 Additive 粒子
  // PLY 桥（赵州桥）：双层 PointsMaterial（实体骨架 + Additive 薄纱光晕）
  const useSingleLayerAdditive = bridge.id === 'wuting' || bridge.id === 'shiqikong'

  return (
    <group ref={groupRef}>
      {useSingleLayerAdditive ? (
        /* ★ OBJ粒子桥：Additive 发光粒子 */
        <points scale={[1, 1, 1]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
            <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.017}
            vertexColors
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            transparent
            opacity={0.42}
            sizeAttenuation
          />
        </points>
      ) : (
        <>
          {/* 第一层：实体骨架层 — 提供清晰结构 */}
          <points scale={[1, 1, 1]}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
              <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial
              size={0.03}
              vertexColors
              blending={THREE.NormalBlending}
              depthWrite={true}
              transparent
              opacity={0.95}
            />
          </points>

          {/* 第二层：光晕薄纱层 */}
          <points ref={glowRef} scale={[1, 1, 1]}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
              <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial
              size={0.06}
              vertexColors
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              transparent
              opacity={0.25}
            />
          </points>
        </>
      )}
    </group>
  )
}

function BridgePlyModel({ bridge }: { bridge: Bridge }) {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Points>(null)
  const plyPath = PLY_MODEL_MAP[bridge.id]

  const geometry = useLoader(PLYLoader, plyPath || '')

  const { positions, colors } = useMemo(() => {
    if (!geometry) return { positions: new Float32Array(0), colors: new Float32Array(0) }

    const posAttr = geometry.getAttribute('position')
    const colAttr = geometry.getAttribute('color')

    // PLY 有原始颜色 → 暖化处理（增强金色感）
    if (colAttr) {
      const count = posAttr.count
      const col = new Float32Array(count * 3)
      const tempColor = new THREE.Color()
      for (let i = 0; i < count; i++) {
        // PLYLoader 已自动归一化到 0-1，直接使用
        tempColor.set(
          colAttr.getX(i),
          colAttr.getY(i),
          colAttr.getZ(i),
        )
        col[i * 3] = tempColor.r
        col[i * 3 + 1] = tempColor.g
        col[i * 3 + 2] = tempColor.b
      }
      return { positions: posAttr.array as Float32Array, colors: col }
    }

    // 无颜色 → 统一暖金色
    const count = posAttr.count
    const col = new Float32Array(count * 3)
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
    return { positions: posAttr.array as Float32Array, colors: col }
  }, [geometry])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = Math.sin(t * 0.12) * 0.1
    groupRef.current.position.y = -0.8 + Math.sin(t * 0.3) * 0.06
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.PointsMaterial
      mat.opacity = 0.18 + Math.sin(t * 0.8) * 0.1
    }
  })

  if (!plyPath || positions.length === 0) return null

  return (
    <group ref={groupRef}>
      {/* 发光光晕层 — 大粒子 + Additive 叠加产生辉光 */}
      <points ref={glowRef} scale={[1, 1, 1]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.015}
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.25}
        />
      </points>

      {/* 主粒子层 — 实体亮金 */}
      <points scale={[1, 1, 1]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
          <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.008}
          vertexColors
          blending={THREE.NormalBlending}
          depthWrite={true}
          transparent
          opacity={0.95}
        />
      </points>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════
// 🔧 临时测试：在赵州桥环境加载五亭桥 OBJ+MTL 贴图模型
// ═══════════════════════════════════════════════════════════
function WutingTestInZhaozhou() {
  const [obj, setObj] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const WUTING_DIR = 'models/五亭桥带贴图模型-新2/'
    const mtlLoader = new MTLLoader()
    mtlLoader.setPath(WUTING_DIR)
    mtlLoader.setResourcePath(WUTING_DIR)
    mtlLoader.load('Meshy_AI_Pavilion_Bridge_0630074245_texture.mtl', (materials) => {
      console.log('[赵州桥环境-五亭桥测试] MTL成功:', Object.keys(materials.materials))
      materials.preload()
      const objLoader = new OBJLoader()
      objLoader.setPath(WUTING_DIR)
      objLoader.setMaterials(materials)
      objLoader.load('五亭桥模型.obj', (loadedObj) => {
        loadedObj.traverse((c: any) => {
          console.log(`[赵州桥环境-五亭桥测试] 子对象: type=${c.type} mat=${c.material?.type} map=${!!c.material?.map}`)
        })
        setObj(loadedObj)
        console.log('[赵州桥环境-五亭桥测试] ✅ 加载完成!')
      }, undefined, (e) => console.error('[赵州桥环境-五亭桥测试] OBJ失败', e))
    })
  }, [])

  if (!obj) return null
  return <primitive object={obj} scale={3} position={[0, -0.5, 0]} />
}

function BridgeParticleModel({ bridge }: { bridge: Bridge }) {
  const pointsRef = useRef<THREE.Points>(null)
  const color = BRIDGE_COLORS[bridge.type] || '#C49A6C'
  const mainColor = useMemo(() => new THREE.Color(color), [color])

  const { positions, colors, sizes } = useMemo(() => {
    const count = 10000
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const siz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const t = i / count
      const x = (t - 0.5) * 8
      const r = Math.random()

      let y: number, z: number
      if (r < 0.25) {
        y = -0.3 + Math.random() * 0.15
        z = (Math.random() - 0.5) * 1.2
      } else if (r < 0.5) {
        const archHeight = 2.8 * (1 - Math.pow(t * 2 - 1, 2))
        y = archHeight * 0.8 + Math.random() * 0.2
        z = (Math.random() - 0.5) * 0.4
      } else if (r < 0.7) {
        const pierX = [-2.5, -1, 1, 2.5][Math.floor(Math.random() * 4)]
        const px = Math.abs(x - pierX) < 0.3
        y = px ? -1.5 + Math.random() * 1.8 : -1 + Math.random() * 0.3
        z = (Math.random() - 0.5) * 1
      } else if (r < 0.85) {
        y = 0.2 + Math.random() * 0.3
        z = (Math.random() > 0.5 ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.15
      } else {
        const cableAngle = Math.random() * Math.PI * 2
        const cableR = 0.3 + Math.random() * 0.8
        y = 0.8 + Math.random() * 2
        z = Math.cos(cableAngle) * cableR
      }

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      const c = mainColor.clone()
      c.r += (Math.random() - 0.5) * 0.12
      c.g += (Math.random() - 0.5) * 0.12
      c.b += (Math.random() - 0.5) * 0.12
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b

      siz[i] = 1 + Math.random() * 4
    }

    return { positions: pos, colors: col, sizes: siz }
  }, [mainColor])

  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    const t = clock.getElapsedTime()
    pointsRef.current.rotation.y = Math.sin(t * 0.15) * 0.12
    pointsRef.current.position.y = Math.sin(t * 0.3) * 0.08
  })

  return (
    <points ref={pointsRef} scale={[0.8, 0.8, 0.8]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-size" array={sizes} count={sizes.length} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.78}
      />
    </points>
  )
}

function WaterParticles() {
  const ref = useRef<THREE.Points>(null)
  const { positions } = useMemo(() => {
    const count = 2000
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9
      pos[i * 3 + 1] = -1.8 + Math.random() * 0.3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3
    }
    return { positions: pos }
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.material.opacity = 0.12 + Math.sin(t * 0.5) * 0.04
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#6B8E7A"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.14}
      />
    </points>
  )
}

function StarField() {
  const ref = useRef<THREE.Points>(null)
  const { positions } = useMemo(() => {
    const count = 400
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5
      const r = 10 + Math.random() * 15
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.cos(phi) + 3
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return { positions: pos }
  }, [])

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.getElapsedTime() * 0.015
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#C49A6C"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.28}
      />
    </points>
  )
}

interface Props {
  bridge: Bridge
  /** 十七孔桥专用：静态图模式隐藏 Canvas，粒子模式显示。其他桥忽略此 prop */
  isParticleMode?: boolean
}

const DRAG_THRESHOLD = 4 // px，光标移动超过此值视为拖拽，不冒泡点击

export default function BridgeCanvas3D({ bridge, isParticleMode = true }: Props) {
  const hasPly = PLY_MODEL_MAP[bridge.id]
  const isShiqikong = bridge.id === 'shiqikong'
  const canvasVisible = !isShiqikong || isParticleMode
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    // 有拖拽动作 → 阻止冒泡以免误关闭卡片；纯点击 → 允许冒泡触发卡片关闭
    if (mouseDownRef.current) {
      const dx = Math.abs(e.clientX - mouseDownRef.current.x)
      const dy = Math.abs(e.clientY - mouseDownRef.current.y)
      mouseDownRef.current = null
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        e.stopPropagation()
        return
      }
    }
    // 纯点击 -> 不阻止冒泡，让 bridge-poster-card 的 onClick 决定行为
  }, [])

  return (
    <div
      className="bridge-poster-canvas-fill"
      style={{
        opacity: canvasVisible ? 1 : 0,
        pointerEvents: canvasVisible ? 'auto' : 'none',
        transition: canvasVisible ? 'opacity 0.5s ease' : 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
    <Canvas
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      camera={{ position: [0, 3.0, 4.0], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={['#E1D7EF', 12, 32]} />

      {/* 灯光系统 — 花间集暖亮风格 */}
      <ambientLight intensity={0.45} color="#FFF8F0" />
      <directionalLight position={[8, 10, 5]} intensity={0.7} color="#FFF5E6" />
      <directionalLight position={[-5, 3, -4]} intensity={0.25} color="#E8DCC8" />
      <pointLight position={[0, -3, 0]} intensity={0.45} color="#C9A882" />
      <pointLight position={[0, 6, 0]} intensity={0.3} color="#FFF8EE" distance={15} />
      <pointLight position={[0, 3, -5]} intensity={0.2} color="#D8CFC0" distance={12} />

      {/* 地面光晕 — 淡暖色 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial color="#D3B885" transparent opacity={0.04} depthWrite={false} />
      </mesh>

      {/* 水纹 */}
      <WaterParticles />

      {/* 桥粒子模型 — 优先 PLY/OBJ 手绘模型，否则用程序化模型 */}
      <Suspense fallback={<BridgeParticleModel bridge={bridge} />}>
        {hasPly ? (
          <>
            <BridgePlyModel bridge={bridge} />
            {/* 🔧 临时：所有桥环境里加载五亭桥贴图模型测试 */}
            <WutingTestInZhaozhou />
          </>
        ) : OBJ_MODEL_MAP[bridge.id] ? (
          <BridgeObjModel bridge={bridge} />
        ) : (
          <BridgeParticleModel bridge={bridge} />
        )}
      </Suspense>

      {/* 星空 */}
      <StarField />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={14}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </Canvas>
    </div>
  )
}
