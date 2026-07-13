import { useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Bridge } from '../../types/bridge'
import { BRIDGE_TYPE_LABELS, BRIDGE_CATEGORY_COLORS } from '../../data/bridges'

/* ══════════════════════════════════════════════
   地理常量 — 复用山河花谱手绘地图已校准值
   底图与山河花谱构图布局一致，无需重调
   (地形转3D模型图1.webp, 2048×1536)
   ══════════════════════════════════════════════ */
const CHINA_LAT_MIN = 1.059
const CHINA_LAT_MAX = 59.942
const CHINA_LNG_MIN = 54.179
const CHINA_LNG_MAX = 171.823

/* ══════ 平面地图参数 ══════ */
const MAP_IMG_URL = 'images/地形转3D模型图1.webp'
const TERRAIN_W = 28      // 世界单位宽度
const TERRAIN_D = 25.76   // 世界单位深度（28 × 0.92 纵横比）

/* ══════ 坐标转换工具 ══════ */
function latLngToGrid(lat: number, lng: number, southShift = 0) {
  const adjLat = lat - southShift // 正值=往南移
  const u = (lng - CHINA_LNG_MIN) / (CHINA_LNG_MAX - CHINA_LNG_MIN)
  const v = 1 - (adjLat - CHINA_LAT_MIN) / (CHINA_LAT_MAX - CHINA_LAT_MIN)
  return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) }
}

function gridToWorld(u: number, v: number) {
  const x = (u - 0.5) * TERRAIN_W
  // FlatMap: v=0(北)→z=-D/2(远), v=1(南)→z=+D/2(近)
  const z = (v - 0.5) * TERRAIN_D
  return { x, z }
}

export function latLngToWorldPos(lat: number, lng: number, southShift = 0): THREE.Vector3 {
  const { u, v } = latLngToGrid(lat, lng, southShift)
  const { x, z } = gridToWorld(u, v)
  return new THREE.Vector3(x, 0.05, z)
}

/* ══════════════════════════════════════════════
   桥标记组件 — 竖版文字图标
   ══════════════════════════════════════════════ */
/** 将 hex 颜色解析为 rgba 组件，用于「分类」模式着色 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* 有3D模型的桥 */
const MODEL_BRIDGE_IDS = ['shiqikong', 'wuting', 'chengyang-yongji']
/* 有线稿图的桥 */
const LINE_DRAWING_BRIDGE_IDS = [
  'zhaozhou', 'wuhan-changjiang', 'chaotianmen', 'luoyang-bridge', 'guangji',
  'tiane-longtan', 'gangzhu-ao', 'beijian', 'anping', 'baodai', 'beipanjiang',
  'lugou', 'luding', 'siduh', 'aizhai', 'hangzhouwan', 'jianshui-shuanglong',
  'lhasa-liuwu', 'changsha-juzizhou', 'haikou-shiji', 'jihong', 'fengqiao', 'lanzhou-zhongshan',
]

function BridgeMarker({
  bridge,
  worldPos,
  isSelected,
  isSpecial,
  tier,
  animate,
  onClick,
  onHoverEnter,
  onHoverLeave,
  categoryColor,
}: {
  bridge: Bridge
  worldPos: THREE.Vector3
  isSelected: boolean
  isSpecial: boolean
  tier: 'model' | 'lineDrawing' | 'normal'
  animate: boolean
  onClick: (b: Bridge) => void
  onHoverEnter: () => void
  onHoverLeave: () => void
  categoryColor?: string
}) {
  const [isHovered, setIsHovered] = useState(false)
  const name = bridge.name
  const firstChar = name.charAt(0)
  const circleSize = isSelected ? 26 : 24
  const labelFontSize = isSelected ? 11 : 10
  const wrapperW = isSelected ? 34 : 32
  const pinOuter = isSelected ? 15 : 13
  const pinInner = isSelected ? 7 : 6

  const c = categoryColor

  const bg = c
    ? (isSelected ? hexToRgba(c, 0.50) : isHovered ? hexToRgba(c, 0.38) : hexToRgba(c, 0.28))
    : (isSelected ? 'rgba(200,182,220,0.50)' : isHovered ? 'rgba(200,182,220,0.38)' : 'rgba(200,182,220,0.28)')
  const border = c
    ? (isSelected ? `1px solid ${hexToRgba(c, 0.50)}` : isHovered ? `1px solid ${hexToRgba(c, 0.40)}` : `1px solid ${hexToRgba(c, 0.28)}`)
    : (isSelected ? '1px solid rgba(206,183,160,0.50)' : isHovered ? '1px solid rgba(206,183,160,0.40)' : '1px solid rgba(206,183,160,0.28)')

  const shadow = c
    ? (isSelected ? `0 0 5px 3px rgba(255,210,60,0.95), 0 0 12px 2px rgba(255,180,40,0.65), 0 0 24px rgba(255,160,30,0.35)` : isHovered ? 'none' : undefined)
    : (isSelected ? '0 0 5px 3px rgba(255,210,60,0.95), 0 0 12px 2px rgba(255,180,40,0.65), 0 0 24px rgba(255,160,30,0.35)' : isHovered ? 'none' : undefined)

  const circleBg = c
    ? (isSelected ? hexToRgba(c, 0.52) : isHovered ? hexToRgba(c, 0.48) : hexToRgba(c, 0.38))
    : (isSelected ? 'rgba(250,246,238,0.52)' : isHovered ? 'rgba(250,246,238,0.48)' : 'rgba(250,246,238,0.38)')
  const circleBorder = c
    ? (isSelected ? `1px solid ${hexToRgba(c, 0.42)}` : isHovered ? `1px solid ${hexToRgba(c, 0.35)}` : `1px solid ${hexToRgba(c, 0.25)}`)
    : (isSelected ? '1px solid rgba(218,208,195,0.42)' : isHovered ? '1px solid rgba(218,208,195,0.35)' : '1px solid rgba(218,208,195,0.25)')
  const firstCharColor = c ? '#FFFFFF' : '#6B5B8A'

  const nameColor = '#3D2550'

  const pinBorderColor = c
    ? (isSelected ? `2px solid ${hexToRgba(c, 0.55)}` : `2px solid ${hexToRgba(c, 0.42)}`)
    : (isSelected ? '2px solid rgba(140,128,155,0.55)' : '2px solid rgba(150,138,162,0.42)')
  const pinShadow = c
    ? (isSelected ? `0 0 10px ${hexToRgba(c, 0.25)}` : `0 0 6px ${hexToRgba(c, 0.10)}`)
    : (isSelected ? '0 0 10px rgba(140,128,155,0.25)' : '0 0 6px rgba(150,138,162,0.10)')
  const pinInnerBg = c || (isSelected ? '#6B5D7A' : '#8A7D95')

  const zIndexRange = tier === 'model' ? [950, 999] : tier === 'lineDrawing' ? [800, 949] : [600, 799]
  const baseZIndex = tier === 'model' ? 950 : tier === 'lineDrawing' ? 800 : 600
  const innerRef = useRef<HTMLDivElement>(null)

  // 强制设置外层容器 z-index（覆盖 drei 的 zIndexRange 分配，确保层级正确）
  useEffect(() => {
    if (!innerRef.current) return
    let container: HTMLElement | null = innerRef.current.parentElement
    while (container) {
      const style = getComputedStyle(container)
      if (style.position === 'absolute' && style.transform !== 'none') break
      container = container.parentElement
    }
    if (container) {
      container.style.zIndex = String(baseZIndex)
    }
  }, [baseZIndex])

  // hover 时提升 z-index 到最高层
  useEffect(() => {
    if (!isHovered || !innerRef.current) return
    let container: HTMLElement | null = innerRef.current.parentElement
    while (container) {
      const style = getComputedStyle(container)
      if (style.position === 'absolute' && style.transform !== 'none') break
      container = container.parentElement
    }
    if (!container) return

    let raf: number
    const setZ = () => {
      if (container) container.style.zIndex = '5000'
      raf = requestAnimationFrame(setZ)
    }
    setZ()

    return () => {
      cancelAnimationFrame(raf)
      if (container) container.style.zIndex = String(baseZIndex)
    }
  }, [isHovered, baseZIndex])

  return (
    <Html position={worldPos} center distanceFactor={8} zIndexRange={zIndexRange}>
      <div ref={innerRef} style={{ position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          className={`bridge-3d-marker${isSelected ? ' selected' : ''}${animate && !isHovered ? ' glow-breathing' : ''}`}
          onClick={(e) => { e.stopPropagation(); onClick(bridge) }}
          onMouseEnter={() => { setIsHovered(true); onHoverEnter() }}
          onMouseLeave={() => { setIsHovered(false); onHoverLeave() }}
          style={{
            width: wrapperW,
            borderRadius: 12,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: shadow,
            border,
            background: bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '5px 4px 6px',
            transition: 'all 0.28s cubic-bezier(0.22,1,0.36,1)',
            userSelect: 'none',
            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          <div style={{
            width: circleSize,
            height: circleSize,
            borderRadius: '50%',
            background: circleBg,
            border: circleBorder,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.28s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <span style={{
              fontFamily: "'汇文明朝体', serif",
              fontSize: 12,
              fontWeight: 500,
              color: firstCharColor,
              lineHeight: 1,
            }}>
              {firstChar}
            </span>
          </div>
          <span style={{
            fontFamily: "'汇文明朝体', serif",
            fontSize: labelFontSize,
            fontWeight: 400,
            color: nameColor,
            letterSpacing: 3,
            lineHeight: 1.4,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            transition: 'color 0.28s ease',
          }}>
            {name}
          </span>
        </div>
        <div
          className="bridge-3d-pin"
          style={{
            width: pinOuter,
            height: pinOuter,
            borderRadius: '50%',
            border: pinBorderColor,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -4,
            transition: 'all 0.28s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: pinShadow,
          }}>
          <div style={{
            width: pinInner,
            height: pinInner,
            borderRadius: '50%',
            background: pinInnerBg,
          }} />
        </div>
      </div>
    </Html>
  )
}

/* ══════════════════════════════════════════════
   Hover 信息卡片 — 独立渲染，最高 z-index
   ══════════════════════════════════════════════ */
function HoverCard({ bridge, worldPos }: { bridge: Bridge; worldPos: THREE.Vector3 }) {
  const big = bridge.id === 'shiqikong'
  const cardRight = bridge.id === 'zhaozhou' || bridge.id === 'shiqikong'
  const { camera, size } = useThree()
  
  const cardOffset = useMemo(() => {
    const vec = worldPos.clone()
    vec.project(camera)
    
    const sx = (vec.x * 0.5 + 0.5) * size.width
    const sy = (-vec.y * 0.5 + 0.5) * size.height
    
    const cardW = big ? 280 : 180
    const cardH = big ? 160 : 100
    const margin = 40
    
    let offsetX = 0
    let offsetY = 0
    
    if (cardRight) {
      if (sx + cardW / 2 > size.width - margin) {
        offsetX = -(sx + cardW / 2 - (size.width - margin))
      }
    } else {
      if (sx + cardW / 2 > size.width - margin) {
        offsetX = -(sx + cardW / 2 - (size.width - margin))
      } else if (sx - cardW / 2 < margin) {
        offsetX = margin - (sx - cardW / 2)
      }
    }
    
    if (sy + cardH + margin > size.height) {
      offsetY = -(sy + cardH + margin - size.height)
    } else if (sy < cardH + margin) {
      offsetY = cardH + margin - sy
    }
    
    return { offsetX, offsetY }
  }, [camera, size, worldPos, big, cardRight])
  
  return (
    <Html position={worldPos} center distanceFactor={8} zIndexRange={[9000, 9999]} style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'relative',
        pointerEvents: 'none',
        animation: 'hcFadeIn 0.18s ease',
        transform: `translate(${cardOffset.offsetX}px, ${cardOffset.offsetY}px)`,
      }}>
        <div style={{
          position: 'absolute',
          ...(cardRight
            ? { left: 14, top: '50%', transform: 'translateY(-50%)' }
            : { left: '50%', bottom: 14, transform: 'translateX(-50%)' }
          ),
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            background: 'rgba(254,252,246,0.68)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            border: '1px solid rgba(201,160,110,0.75)',
            borderRadius: big ? 10 : 8,
            padding: big ? '11px 14px' : '8px 11px',
            ...(bridge.id === 'zhaozhou' ? { maxWidth: 280 } : {}),
            boxShadow: [
              '0 4px 20px rgba(160,140,120,0.08)',
              '0 0 14px rgba(180,155,130,0.04)',
              'inset 0 1px 0 rgba(255,255,255,0.50)',
              'inset 0 -1px 0 rgba(200,185,160,0.08)',
            ].join(', '),
            display: 'flex',
            flexDirection: 'column',
            gap: big ? 4 : 3,
            position: 'relative',
          }}>
            {/* 朝代标签 */}
            <span style={{
              fontFamily: "'汇文明朝体', serif",
              fontSize: big ? 10 : 9,
              letterSpacing: 2,
              color: '#8B7B6B',
              background: 'rgba(210,195,170,0.20)',
              padding: big ? '2px 10px' : '2px 8px',
              borderRadius: 8,
              alignSelf: 'flex-start',
            }}>
              {bridge.era}
            </span>
            {/* 桥名 */}
            <span style={{
              fontFamily: "'汇文明朝体', serif",
              fontSize: big ? 14 : 12,
              fontWeight: 500,
              color: '#5A4230',
              letterSpacing: big ? 3 : 2,
            }}>
              {bridge.name}
            </span>
            {/* 年代 + 材质 */}
            <span style={{
              fontFamily: "'Noto Serif SC', serif",
              fontSize: big ? 11 : 10,
              color: '#9B8B78',
              letterSpacing: 1,
              opacity: 0.75,
            }}>
              {bridge.year} · {bridge.material} · {bridge.length}
            </span>
            {/* 第一条特点 */}
            {bridge.features[0] && (
              <span style={{
                fontFamily: "'Noto Serif SC', serif",
                fontSize: big ? 10 : 9,
                color: '#8B7B6B',
                letterSpacing: 1,
                opacity: 0.65,
                ...(bridge.id === 'zhaozhou' ? { whiteSpace: 'normal', display: 'block' } as any : {}),
              }}>
                ★ {bridge.features[0]}
              </span>
            )}
            {/* 五亭桥线稿图 */}
            {bridge.id === 'wuting' && (
              <img
                src="images/五亭桥-线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 十七孔桥线稿图 */}
            {bridge.id === 'shiqikong' && (
              <img
                src="images/十七孔桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 赵州桥线稿图 */}
            {bridge.id === 'zhaozhou' && (
              <img
                src="images/赵州桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 程阳永济桥线稿图 */}
            {bridge.id === 'chengyang-yongji' && (
              <img
                src="images/程阳永济桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 武汉长江大桥线稿图 */}
            {bridge.id === 'wuhan-changjiang' && (
              <img
                src="images/武汉长江大桥.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 朝天门长江大桥线稿图 */}
            {bridge.id === 'chaotianmen' && (
              <img
                src="images/朝天门长江大桥.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 洛阳桥线稿图 */}
            {bridge.id === 'luoyang-bridge' && (
              <img
                src="images/洛阳桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 广济桥线稿图 */}
            {bridge.id === 'guangji' && (
              <img
                src="images/广济桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 天峨龙滩特大桥线稿图 */}
            {bridge.id === 'tiane-longtan' && (
              <img
                src="images/天峨龙滩特大桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 港珠澳大桥线稿图 */}
            {bridge.id === 'gangzhu-ao' && (
              <img
                src="images/港珠澳大桥线稿图.webp"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 北涧桥线稿图 */}
            {bridge.id === 'beijian' && (
              <img
                src="images/线稿图/北涧桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 安平桥线稿图 */}
            {bridge.id === 'anping' && (
              <img
                src="images/线稿图/安平桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 宝带桥线稿图 */}
            {bridge.id === 'baodai' && (
              <img
                src="images/线稿图/宝带桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 北盘江第一桥线稿图 */}
            {bridge.id === 'beipanjiang' && (
              <img
                src="images/线稿图/北盘江第一桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 卢沟桥线稿图 */}
            {bridge.id === 'lugou' && (
              <img
                src="images/线稿图/卢沟桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 泸定桥线稿图 */}
            {bridge.id === 'luding' && (
              <img
                src="images/线稿图/泸定桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 四渡河大桥线稿图 */}
            {bridge.id === 'siduh' && (
              <img
                src="images/线稿图/四渡河桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 矮寨大桥线稿图 */}
            {bridge.id === 'aizhai' && (
              <img
                src="images/线稿图/矮寨大桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 杭州湾跨海大桥线稿图 */}
            {bridge.id === 'hangzhouwan' && (
              <img
                src="images/线稿图/杭州湾跨海大桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 建水双龙桥线稿图 */}
            {bridge.id === 'jianshui-shuanglong' && (
              <img
                src="images/线稿图/建水双龙桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 拉萨柳梧大桥线稿图 */}
            {bridge.id === 'lhasa-liuwu' && (
              <img
                src="images/线稿图/拉萨柳梧大桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 长沙橘子洲大桥线稿图 */}
            {bridge.id === 'changsha-juzizhou' && (
              <img
                src="images/线稿图/长沙橘子洲大桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 海口世纪大桥线稿图 */}
            {bridge.id === 'haikou-shiji' && (
              <img
                src="images/线稿图/海口世纪大桥.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 霁虹桥线稿图 */}
            {bridge.id === 'jihong' && (
              <img
                src="images/线稿图/霁虹桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 枫桥线稿图 */}
            {bridge.id === 'fengqiao' && (
              <img
                src="images/线稿图/枫桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 兰州黄河铁桥线稿图 */}
            {bridge.id === 'lanzhou-zhongshan' && (
              <img
                src="images/线稿图/兰州黄河铁桥线稿图.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  marginTop: 4,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 三角箭头 */}
            <div style={{
              position: 'absolute',
              ...(cardRight
                ? { left: -6, top: '50%', transform: 'translateY(-50%)', borderRight: '6px solid rgba(201,160,110,0.75)', borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }
                : { bottom: -6, left: '50%', transform: 'translateX(-50%)', borderTop: '6px solid rgba(201,160,110,0.75)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }
              ),
              width: 0,
              height: 0,
            }} />
          </div>
        </div>
      </div>
    </Html>
  )
}

/* ══════════════════════════════════════════════
   平面地图 — 四顶点四边形 + MeshBasicMaterial
   ══════════════════════════════════════════════ */
function FlatMap({ texture }: { texture: THREE.Texture }) {
  const geometry = useMemo(() => {
    const hw = TERRAIN_W / 2
    const hd = TERRAIN_D / 2
    // 顶点顺序：西南→东南→东北→西北
    // 确保图的北部在远端(z=-hd)、南部在近端(z=+hd)
    const verts = new Float32Array([
      -hw, 0,  hd,  // 0: 西南 (图底/南)
       hw, 0,  hd,  // 1: 东南 (图底/南)
       hw, 0, -hd,  // 2: 东北 (图顶/北)
      -hw, 0, -hd,  // 3: 西北 (图顶/北)
    ])
    const uvs = new Float32Array([
      0, 0,  // 0: 图左下=南西
      1, 0,  // 1: 图右下=南东
      1, 1,  // 2: 图右上=北东
      0, 1,  // 3: 图左上=北西
    ])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    return g
  }, [])

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ══════════════════════════════════════════════
   相机控制器 — 全局/局部视图切换
   ══════════════════════════════════════════════ */
export interface CamConfig { px: number; py: number; pz: number; tx: number; ty: number; tz: number }
export interface CamOverride { pos: THREE.Vector3; target: THREE.Vector3 }

function CameraController({
  viewMode,
  globalCam,
  localCam,
  focusTarget,
  camOverride,
  calibrateMode,
  onFocusDone,
  onCameraUpdate,
}: {
  viewMode: 'global' | 'local'
  globalCam: CamConfig
  localCam: CamConfig
  focusTarget: THREE.Vector3 | null
  camOverride: CamOverride | null
  calibrateMode?: boolean
  onFocusDone?: () => void
  onCameraUpdate?: (pos: THREE.Vector3, target: THREE.Vector3) => void
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const animatingRef = useRef(false)
  const prevFocusKeyRef = useRef<string | null>(null)

  useEffect(() => {
    // focusTarget 变化（新增/切换桥）时 → 飞向目标桥
    if (focusTarget) {
      const key = camOverride
        ? `${camOverride.pos.x},${camOverride.pos.z},${camOverride.target.x},${camOverride.target.z}`
        : `${focusTarget.x},${focusTarget.z}`
      if (key !== prevFocusKeyRef.current) {
        prevFocusKeyRef.current = key
        // 有自定义配置 → 直接用；否则自动计算
        const targetPos = camOverride
          ? camOverride.pos.clone()
          : new THREE.Vector3(focusTarget.x + 2.0, focusTarget.y + 4.5, focusTarget.z + 4.0)
        const targetTgt = camOverride
          ? camOverride.target.clone()
          : focusTarget.clone()

        const dist = camera.position.distanceTo(targetPos)
        if (dist < 0.1) { onFocusDone?.(); return }

        animatingRef.current = true
        const startPos = camera.position.clone()
        const startTgt = controlsRef.current?.target?.clone() || new THREE.Vector3(0, 0, 0)
        const startTime = performance.now()
        const duration = 900

        function animate(now: number) {
          const elapsed = now - startTime
          const t = Math.min(1, elapsed / duration)
          const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
          camera.position.lerpVectors(startPos, targetPos, ease)
          if (controlsRef.current) {
            controlsRef.current.target.lerpVectors(startTgt, targetTgt, ease)
            controlsRef.current.update()
          }
          if (t < 1) { requestAnimationFrame(animate) }
          else { animatingRef.current = false; onFocusDone?.() }
        }
        requestAnimationFrame(animate)
      }
      // focusTarget 没变 → 可能是 viewMode 变了，交给下面的 viewMode 逻辑
      // 不清除 prevFocusKeyRef，这样点+/-后 focusTarget 不变所以不重飞
    } else {
      prevFocusKeyRef.current = null
    }

    // viewMode 切换（全局/局部）— 仅无焦点时生效
    if (!focusTarget) {
      const cfg = viewMode === 'global' ? globalCam : localCam
      const targetPos = new THREE.Vector3(cfg.px, cfg.py, cfg.pz)
      const targetTgt = new THREE.Vector3(cfg.tx, cfg.ty, cfg.tz)

      const dist = camera.position.distanceTo(targetPos)
      if (dist < 0.05) return

      animatingRef.current = true
      const startPos = camera.position.clone()
      const startTgt = controlsRef.current?.target?.clone() || new THREE.Vector3(0, 0, 0)
      const startTime = performance.now()
      const duration = 800

      function animate(now: number) {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

        camera.position.lerpVectors(startPos, targetPos, ease)
        if (controlsRef.current) {
          controlsRef.current.target.lerpVectors(startTgt, targetTgt, ease)
          controlsRef.current.update()
        }

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          animatingRef.current = false
        }
      }

      requestAnimationFrame(animate)
    }
  }, [viewMode, camera, globalCam, localCam, focusTarget, camOverride])

  useFrame(() => {
    if (onCameraUpdate && controlsRef.current) {
      const tgt = controlsRef.current.target as THREE.Vector3
      onCameraUpdate(camera.position.clone(), tgt.clone())
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={calibrateMode ? 0.05 : 0.15}
      maxPolarAngle={calibrateMode ? Math.PI * 0.85 : Math.PI * 0.48}
      minDistance={calibrateMode ? 0.2 : 0.4}
      maxDistance={calibrateMode ? 60 : 30}
      zoomSpeed={2.5}
      target={[0, 0, 0]}
      enableZoom={!!calibrateMode}
      enablePan={!!calibrateMode}
      enableRotate={!!calibrateMode}
    />
  )
}

/* ══════════════════════════════════════════════
   超大底座 — 同色平面盖住地形边缘，消除方形边界
   ══════════════════════════════════════════════ */
function BasePlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#eef2ec" side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

/* ══════════════════════════════════════════════
   内部场景
   ══════════════════════════════════════════════ */
interface TerrainSceneProps {
  bridges: Bridge[]
  selectedBridge: Bridge | null
  viewMode: 'global' | 'local'
  globalCam: CamConfig
  localCam: CamConfig
  focusTarget: THREE.Vector3 | null
  camOverride: CamOverride | null
  calibrateMode?: boolean
  onFocusDone?: () => void
  onCameraUpdate?: (pos: THREE.Vector3, target: THREE.Vector3) => void
  onSelectBridge: (bridge: Bridge) => void
  categoryColors: Record<string, string> | null
}

export const SOUTH_SHIFT = 3.5 // 往南偏移纬度°（已确认定位 2026-06-08）

function TerrainScene({ bridges, selectedBridge, viewMode, globalCam, localCam, focusTarget, camOverride, calibrateMode, onFocusDone, onCameraUpdate, onSelectBridge, categoryColors }: TerrainSceneProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredBridgeId, setHoveredBridgeId] = useState<string | null>(null)
  const { camera } = useThree()
  const frustumRef = useRef(new THREE.Frustum())
  const visibleIdsRef = useRef<Set<string>>(new Set())
  const lastUpdateRef = useRef(0)
  const [visibleBridgeIds, setVisibleBridgeIds] = useState<Set<string>>(new Set())
  const [breathingIds, setBreathingIds] = useState<Set<string>>(new Set())
  const breathingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    breathingIdsRef.current = breathingIds
  }, [breathingIds])

  // 只加载平面地图图
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = MAP_IMG_URL
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = true
      setTexture(tex)
      setLoading(false)
    }
    img.onerror = () => setLoading(false)
  }, [])

  // 桥标记世界坐标（有模型→有线稿图→普通，按层级排序，后渲染的z-index更高）
  const modelSet = useMemo(() => new Set(MODEL_BRIDGE_IDS), [])
  const lineDrawingSet = useMemo(() => new Set(LINE_DRAWING_BRIDGE_IDS), [])
  const bridgeMarkers = useMemo(() => {
    if (!texture) return []
    const list = bridges.map(bridge => {
      const tier: 'model' | 'lineDrawing' | 'normal' = modelSet.has(bridge.id) ? 'model' : lineDrawingSet.has(bridge.id) ? 'lineDrawing' : 'normal'
      return {
        bridge,
        pos: latLngToWorldPos(bridge.lat, bridge.lng, SOUTH_SHIFT),
        tier,
      }
    })
    // 普通 → 线稿图 → 模型（后渲染的在上层）
    list.sort((a, b) => {
      const order = { normal: 0, lineDrawing: 1, model: 2 }
      return order[a.tier] - order[b.tier]
    })
    return list
  }, [bridges, texture, modelSet, lineDrawingSet])

  // 初始化时显示所有桥
  useEffect(() => {
    if (bridgeMarkers.length > 0 && visibleIdsRef.current.size === 0) {
      const ids = new Set(bridgeMarkers.map(m => m.bridge.id))
      visibleIdsRef.current = ids
      setVisibleBridgeIds(ids)
    }
  }, [bridgeMarkers])

  // 视锥体裁剪 + 空间聚类呼吸：每帧检测，但节流更新state（每100ms最多一次）
  useFrame((_, delta) => {
    if (!texture || bridgeMarkers.length === 0) return
    lastUpdateRef.current += delta * 1000
    if (lastUpdateRef.current < 100) return
    lastUpdateRef.current = 0

    camera.updateMatrixWorld()
    frustumRef.current.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    )
    const visible = new Set<string>()
    for (const { bridge, pos, tier } of bridgeMarkers) {
      const margin = tier === 'model' ? 4 : 2
      const box = new THREE.Box3(
        new THREE.Vector3(pos.x - margin, -1, pos.z - margin),
        new THREE.Vector3(pos.x + margin, 2, pos.z + margin)
      )
      if (frustumRef.current.intersectsBox(box)) {
        visible.add(bridge.id)
      }
    }

    // 空间聚类呼吸：每个区域只选一个桥呼吸
    // 1. 获取视野内桥按优先级排序（模型桥优先）
    const visibleMarkers = bridgeMarkers
      .filter(m => visible.has(m.bridge.id))
      .sort((a, b) => {
        const order = { model: 0, lineDrawing: 1, normal: 2 }
        return order[a.tier] - order[b.tier]
      })
    // 2. 贪心选择：已选中的桥间距必须 >= 阈值
    const BREATH_DIST_THRESHOLD = 12 // 单位：世界坐标
    const breathSet = new Set<string>()
    for (const m of visibleMarkers) {
      let tooClose = false
      for (const id of breathSet) {
        const other = bridgeMarkers.find(bm => bm.bridge.id === id)
        if (!other) continue
        const dist = m.pos.distanceTo(other.pos)
        if (dist < BREATH_DIST_THRESHOLD) {
          tooClose = true
          break
        }
      }
      if (!tooClose) {
        breathSet.add(m.bridge.id)
      }
    }

    const prev = visibleIdsRef.current
    const prevBreath = breathingIdsRef.current
    const visibleChanged = prev.size !== visible.size || [...prev].some(id => !visible.has(id))
    const breathChanged = prevBreath.size !== breathSet.size || [...prevBreath].some(id => !breathSet.has(id))
    if (visibleChanged || breathChanged) {
      if (visibleChanged) visibleIdsRef.current = visible
      if (breathChanged) {
        breathingIdsRef.current = breathSet
        setBreathingIds(new Set(breathSet))
      }
      if (visibleChanged) setVisibleBridgeIds(new Set(visible))
    }
  })

  // 当前 hover 的桥对象
  const hoveredBridge = useMemo(() => {
    if (!hoveredBridgeId) return null
    return bridges.find(b => b.id === hoveredBridgeId) || null
  }, [hoveredBridgeId, bridges])

  // hover 桥的世界坐标
  const hoveredPos = useMemo(() => {
    if (!hoveredBridge) return null
    return latLngToWorldPos(hoveredBridge.lat, hoveredBridge.lng, SOUTH_SHIFT)
  }, [hoveredBridge])

  if (loading) return null

  return (
    <>
      <color attach="background" args={['#eef2ec']} />

      {/* 平面地图不需要复杂光照，保留基础环境光即可 */}
      <ambientLight intensity={1.2} color="#ffffff" />

      {/* 超大底座 */}
      <BasePlane />

      {/* 平面地图 */}
      {texture && <FlatMap texture={texture} />}

      {/* 桥标记点 - 只渲染视野内的 */}
      {bridgeMarkers.map(({ bridge, pos, tier }) => {
        const isVisible = visibleBridgeIds.has(bridge.id)
        if (!isVisible) return null
        return (
          <BridgeMarker
            key={bridge.id}
            bridge={bridge}
            worldPos={pos}
            isSelected={selectedBridge?.id === bridge.id}
            isSpecial={bridge.id === 'shiqikong' || bridge.id === 'wuting' || bridge.id === 'chengyang-yongji'}
            tier={tier}
            animate={breathingIds.has(bridge.id)}
            onClick={onSelectBridge}
            onHoverEnter={() => setHoveredBridgeId(bridge.id)}
            onHoverLeave={() => setHoveredBridgeId(null)}
            categoryColor={categoryColors?.[bridge.type] ?? undefined}
          />
        )
      })}

      {/* hover 信息卡 — 独立 Html，最高 z-index */}
      {hoveredBridge && hoveredPos && (
        <HoverCard bridge={hoveredBridge} worldPos={hoveredPos} />
      )}

      <CameraController viewMode={viewMode} globalCam={globalCam} localCam={localCam} focusTarget={focusTarget} camOverride={camOverride} calibrateMode={calibrateMode} onFocusDone={onFocusDone} onCameraUpdate={onCameraUpdate} />

      <fogExp2 attach="fog" args={['#eef2ec', 0.04]} />
    </>
  )
}

/* ══════════════════════════════════════════════
   顶层组件 — R3F Canvas 包装
   ══════════════════════════════════════════════ */
interface Terrain3DProps {
  bridges: Bridge[]
  selectedBridge: Bridge | null
  viewMode: 'global' | 'local'
  focusTarget: THREE.Vector3 | null
  camOverride: CamOverride | null
  calibrateMode?: boolean
  onFocusDone?: () => void
  onCameraUpdate?: (pos: THREE.Vector3, target: THREE.Vector3) => void
  onSelectBridge: (bridge: Bridge) => void
  categoryColors: Record<string, string> | null
}

// 全局/局部视角硬编码定位（2026-06-08 确认，不可丢失）
const GLOBAL_CAM: CamConfig = { px: 0.61, py: 6.48, pz: 7.80, tx: -0.23, ty: -1.51, tz: 1.48 }
const LOCAL_CAM: CamConfig  = { px: 0.80, py: 3.73, pz: 4.16, tx: 1.09,  ty: -0.14, tz: -0.54 }

export default function Terrain3D({ bridges, selectedBridge, viewMode, focusTarget, camOverride, calibrateMode, onFocusDone, onCameraUpdate, onSelectBridge, categoryColors }: Terrain3DProps) {
  const [globalCam] = useState<CamConfig>(GLOBAL_CAM)
  const [localCam] = useState<CamConfig>(LOCAL_CAM)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 2.2, 3.0], fov: 50, near: 0.3, far: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <TerrainScene
          bridges={bridges}
          selectedBridge={selectedBridge}
          viewMode={viewMode}
          globalCam={globalCam}
          localCam={localCam}
          focusTarget={focusTarget}
          camOverride={camOverride}
          onFocusDone={onFocusDone}
          onCameraUpdate={onCameraUpdate}
          onSelectBridge={onSelectBridge}
          categoryColors={categoryColors}
        />
      </Canvas>
    </div>
  )
}
