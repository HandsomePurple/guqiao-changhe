import type { Bridge } from '../../types/bridge'

/** 每座桥的 SVG 简笔画（120×60 viewBox） */
type SketchRenderer = (opts: { color?: string; strokeWidth?: number; size?: number }) => JSX.Element

const SKETCH_COLOR = '#8CA5A2'

/* ══════════════════════════════════════════════
   隋唐 — 2座
   ══════════════════════════════════════════════ */

/** 赵州桥：大拱 + 两肩小拱 */
function ZhaoZhouSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 主拱 */}
      <path d="M10,55 Q60,-20 110,55" />
      {/* 左肩小拱 */}
      <path d="M22,40 Q30,22 42,40" />
      {/* 右肩小拱 */}
      <path d="M78,40 Q90,22 98,40" />
      {/* 桥面线 */}
      <path d="M8,35 L112,35" strokeWidth={strokeWidth * 0.7} opacity={0.5} />
    </svg>
  )
}

/** 宝带桥：一排小拱弧 */
function BaoDaiSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 桥面线 */}
      <path d="M6,30 L114,30" strokeWidth={strokeWidth * 0.7} opacity={0.5} />
      {/* 五组等间距小拱 */}
      <path d="M12,30 Q20,48 28,30" />
      <path d="M26,30 Q34,48 42,30" />
      <path d="M40,30 Q48,48 56,30" />
      <path d="M54,30 Q62,48 70,30" />
      <path d="M68,30 Q76,48 84,30" />
      <path d="M82,30 Q90,48 98,30" />
      <path d="M96,30 Q104,48 112,30" />
      {/* 桥墩 */}
      <path d="M28,30 L28,55" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M56,30 L56,55" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M84,30 L84,55" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
    </svg>
  )
}

/* ══════════════════════════════════════════════
   宋元 — 6座
   ══════════════════════════════════════════════ */

/** 洛阳桥：平直长梁式 */
function LuoYangSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 桥面水平线 */}
      <path d="M6,28 L114,28" strokeWidth={strokeWidth * 1.2} />
      {/* 下方支柱（筏形基础） */}
      <path d="M20,28 L20,50" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      <path d="M40,28 L40,50" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      <path d="M60,28 L60,50" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      <path d="M80,28 L80,50" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      <path d="M100,28 L100,50" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      {/* 底部锯齿线（蛎固基） */}
      <path d="M18,48 L22,46 L26,48 L30,46 L34,48 L38,46 L42,48 L46,46 L50,48 L54,46 L58,48 L62,46 L66,48 L70,46 L74,48 L78,46 L82,48 L86,46 L90,48 L94,46 L98,48 L102,46" strokeWidth={strokeWidth * 0.5} opacity={0.3} />
    </svg>
  )
}

/** 安平桥：超长平直石梁 */
function AnPingSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 超长桥面 */}
      <path d="M4,28 L116,28" strokeWidth={strokeWidth * 1.3} />
      {/* 密集支柱 */}
      {[15, 28, 41, 54, 67, 80, 93, 106].map((x) => (
        <path key={x} d={`M${x},28 L${x},48`} strokeWidth={strokeWidth * 0.6} opacity={0.4} />
      ))}
      {/* 桥头亭标识点 */}
      <circle cx="10" cy="24" r="2" fill={color} opacity={0.5} />
      <circle cx="110" cy="24" r="2" fill={color} opacity={0.5} />
    </svg>
  )
}

/** 广济桥：两段 + 中间缺口（梭船） */
function GuangJiSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左侧桥段 */}
      <path d="M6,30 L45,30" strokeWidth={strokeWidth * 1.2} />
      <path d="M14,30 L14,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M28,30 L28,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M42,30 L42,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      {/* 右侧桥段 */}
      <path d="M75,30 L114,30" strokeWidth={strokeWidth * 1.2} />
      <path d="M78,30 L78,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M92,30 L92,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      <path d="M106,30 L106,46" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      {/* 中间梭船（虚线弧形） */}
      <path d="M48,30 C53,20 58,22 60,30" strokeWidth={strokeWidth * 0.7} opacity={0.45} strokeDasharray="4 3" />
      <path d="M60,30 C62,22 67,20 72,30" strokeWidth={strokeWidth * 0.7} opacity={0.45} strokeDasharray="4 3" />
      {/* 水面波纹 */}
      <path d="M46,36 Q52,32 58,36 Q64,40 70,36 Q76,32 82,36" strokeWidth={strokeWidth * 0.4} opacity={0.25} />
    </svg>
  )
}

/** 卢沟桥：11个小联拱 */
function LuGouSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 桥面线 */}
      <path d="M6,28 L114,28" strokeWidth={strokeWidth * 0.7} opacity={0.45} />
      {/* 11个联拱 */}
      {[10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90].map((x) => (
        <path key={x} d={`M${x},28 Q${x + 4},46 ${x + 8},28`} />
      ))}
      {/* 石狮点（几个小圆） */}
      <circle cx="14" cy="25" r="1" fill={color} opacity={0.35} />
      <circle cx="38" cy="25" r="1" fill={color} opacity={0.35} />
      <circle cx="62" cy="25" r="1" fill={color} opacity={0.35} />
      <circle cx="86" cy="25" r="1" fill={color} opacity={0.35} />
    </svg>
  )
}

/** 鱼沼飞梁：十字交叉形 */
function YuZhaoSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 东西平坦桥面 */}
      <path d="M10,30 L110,30" strokeWidth={strokeWidth * 1.1} />
      {/* 南北微拱桥面 */}
      <path d="M60,6 Q55,30 60,54" strokeWidth={strokeWidth} />
      <path d="M60,6 Q65,30 60,54" strokeWidth={strokeWidth} />
      {/* 方池边框 */}
      <rect x="35" y="18" width="50" height="24" rx="3" strokeWidth={strokeWidth * 0.6} opacity={0.35} />
      {/* 中心十字标记 */}
      <circle cx="60" cy="30" r="3" fill={color} opacity={0.4} />
    </svg>
  )
}

/** 江东桥：粗壮水平石梁 */
function JiangDongSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 超粗石梁 */}
      <path d="M10,30 L110,30" strokeWidth={strokeWidth * 2.5} />
      <path d="M10,28 L110,28" strokeWidth={strokeWidth * 0.5} opacity={0.3} />
      <path d="M10,32 L110,32" strokeWidth={strokeWidth * 0.5} opacity={0.3} />
      {/* 两端桥墩 */}
      <path d="M14,24 L14,48" strokeWidth={strokeWidth * 1.2} opacity={0.35} />
      <path d="M106,24 L106,48" strokeWidth={strokeWidth * 1.2} opacity={0.35} />
      {/* 中墩 */}
      <path d="M60,24 L60,48" strokeWidth={strokeWidth * 0.8} opacity={0.3} />
      {/* 重量标注暗示 */}
      <text x="60" y="14" textAnchor="middle" fill={color} fontSize="7" opacity={0.35} fontFamily="serif">200t</text>
    </svg>
  )
}

/* ══════════════════════════════════════════════
   明清 — 4座
   ══════════════════════════════════════════════ */

/** 泸定桥：悬链线（下凹曲线） */
function LuDingSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左塔 */}
      <path d="M18,10 L18,48" strokeWidth={strokeWidth * 1.5} />
      <path d="M14,48 L22,48" strokeWidth={strokeWidth} />
      {/* 右塔 */}
      <path d="M102,10 L102,48" strokeWidth={strokeWidth * 1.5} />
      <path d="M98,48 L106,48" strokeWidth={strokeWidth} />
      {/* 悬链线主索（下凹） */}
      <path d="M18,12 Q36,38 60,42 Q84,38 102,12" strokeWidth={strokeWidth} />
      {/* 桥面（轻微下凹） */}
      <path d="M18,30 Q36,40 60,42 Q84,40 102,30" strokeWidth={strokeWidth * 0.8} opacity={0.55} />
      {/* 竖向拉索（吊杆） */}
      {[28, 38, 48, 60, 72, 82, 92].map((x) => (
        <path key={x} d={`M${x},${28 + (x - 18) * 0.1} L${x},${38 + Math.abs(x - 60) * 0.03}`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
    </svg>
  )
}

/** 五亭桥：中央高 + 四角低 */
function WuTingSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* 桥面弧 */}
      <path d="M10,38 Q30,32 60,30 Q90,32 110,38" strokeWidth={strokeWidth * 0.8} />
      {/* 中央亭（最高） */}
      <path d="M50,30 L50,12 L70,12 L70,30" strokeWidth={strokeWidth} />
      <path d="M48,12 L72,12 L60,4 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 左二亭 */}
      <path d="M26,34 L26,20 L38,20 L38,34" strokeWidth={strokeWidth} />
      <path d="M24,20 L40,20 L32,14 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 右二亭 */}
      <path d="M82,34 L82,20 L94,20 L94,34" strokeWidth={strokeWidth} />
      <path d="M80,20 L96,20 L88,14 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 左一亭 */}
      <path d="M14,36 L14,26 L22,26 L22,36" strokeWidth={strokeWidth} />
      <path d="M12,26 L24,26 L18,22 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 右一亭 */}
      <path d="M98,36 L98,26 L106,26 L106,36" strokeWidth={strokeWidth} />
      <path d="M96,26 L108,26 L102,22 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 桥洞 */}
      <path d="M36,38 Q44,52 52,38" strokeWidth={strokeWidth * 0.7} opacity={0.4} />
      <path d="M52,38 Q60,52 68,38" strokeWidth={strokeWidth * 0.7} opacity={0.4} />
      <path d="M68,38 Q76,52 84,38" strokeWidth={strokeWidth * 0.7} opacity={0.4} />
    </svg>
  )
}

/** 十七孔桥：17孔长联拱 */
function ShiQiKongSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 桥面弧线 */}
      <path d="M6,29 Q60,24 114,29" strokeWidth={strokeWidth * 0.8} opacity={0.5} />
      {/* 17个拱洞 */}
      {Array.from({ length: 17 }, (_, i) => {
        const x = 10 + i * 6
        return <path key={i} d={`M${x},29 Q${x + 3},46 ${x + 6},29`} />
      })}
    </svg>
  )
}

/** 程阳永济桥：廊屋+塔亭 */
function ChengYangSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* 桥墩 */}
      <path d="M16,34 L16,48" strokeWidth={strokeWidth * 1.2} opacity={0.4} />
      <path d="M46,34 L46,48" strokeWidth={strokeWidth * 1.2} opacity={0.4} />
      <path d="M76,34 L76,48" strokeWidth={strokeWidth * 1.2} opacity={0.4} />
      <path d="M106,34 L106,48" strokeWidth={strokeWidth * 1.2} opacity={0.4} />
      {/* 桥面 */}
      <path d="M10,34 L114,34" strokeWidth={strokeWidth * 0.8} />
      {/* 中央亭（最高） */}
      <path d="M52,34 L52,12 L68,12 L68,34" strokeWidth={strokeWidth} />
      <path d="M50,12 L70,12 L60,4 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 两侧亭 */}
      <path d="M24,34 L24,20 L36,20 L36,34" strokeWidth={strokeWidth} />
      <path d="M22,20 L38,20 L30,14 Z" strokeWidth={strokeWidth * 0.8} />
      <path d="M84,34 L84,20 L96,20 L96,34" strokeWidth={strokeWidth} />
      <path d="M82,20 L98,20 L90,14 Z" strokeWidth={strokeWidth * 0.8} />
      {/* 廊脊线（锯齿） */}
      <path d="M12,34 L18,28 L24,34 L30,28 L36,34 L42,28 L48,34 L52,34 M68,34 L76,28 L82,34 L88,28 L94,34 L100,28 L106,34" strokeWidth={strokeWidth * 0.5} opacity={0.4} />
    </svg>
  )
}

/* ══════════════════════════════════════════════
   现代 — 8座
   ══════════════════════════════════════════════ */

/** 武汉长江大桥：桁架网格 */
function WuHanSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 上层桥面 */}
      <path d="M6,18 L114,18" strokeWidth={strokeWidth} />
      {/* 下层桥面 */}
      <path d="M6,36 L114,36" strokeWidth={strokeWidth} />
      {/* 桁架网格 */}
      {Array.from({ length: 10 }, (_, i) => {
        const x = 12 + i * 10.8
        return (
          <g key={i}>
            <path d={`M${x},18 L${x + 5},27 L${x},36`} strokeWidth={strokeWidth * 0.5} opacity={0.45} />
            <path d={`M${x + 5},18 L${x + 5},36`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
            {i < 9 && <path d={`M${x + 5},27 L${x + 10.8},18`} strokeWidth={strokeWidth * 0.5} opacity={0.45} />}
          </g>
        )
      })}
      {/* 桥墩 */}
      <path d="M30,36 L30,50" strokeWidth={strokeWidth * 1.5} opacity={0.5} />
      <path d="M60,36 L60,50" strokeWidth={strokeWidth * 1.5} opacity={0.5} />
      <path d="M90,36 L90,50" strokeWidth={strokeWidth * 1.5} opacity={0.5} />
    </svg>
  )
}

/** 北盘江第一桥：高塔 + 斜拉索 */
function BeiPanJiangSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左塔（极高） */}
      <path d="M30,6 L30,44" strokeWidth={strokeWidth * 1.8} />
      {/* 右塔 */}
      <path d="M90,6 L90,44" strokeWidth={strokeWidth * 1.8} />
      {/* 桥面 */}
      <path d="M10,26 L30,26" strokeWidth={strokeWidth * 0.8} />
      <path d="M30,26 L90,26" strokeWidth={strokeWidth} />
      <path d="M90,26 L110,26" strokeWidth={strokeWidth * 0.8} />
      {/* 斜拉索（左塔） */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`bl-${i}`} d={`M30,${10 + i * 4} L18,26`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`br-${i}`} d={`M30,${10 + i * 4} L42,26`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
      {/* 斜拉索（右塔） */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`rl-${i}`} d={`M90,${10 + i * 4} L78,26`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`rr-${i}`} d={`M90,${10 + i * 4} L102,26`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
      {/* 高度标注 */}
      <text x="70" y="14" textAnchor="middle" fill={color} fontSize="7" opacity={0.4} fontFamily="serif">565m</text>
    </svg>
  )
}

/** 丹昆特大桥：极长水平线 */
function DanKunSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 极长桥面 */}
      <path d="M2,24 L118,24" strokeWidth={strokeWidth * 1.5} />
      {/* 均匀支柱 */}
      {Array.from({ length: 17 }, (_, i) => {
        const x = 12 + i * 6
        return <path key={i} d={`M${x},24 L${x},44`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      })}
      {/* 长度线 两侧端标 */}
      <path d="M2,48 L2,42" strokeWidth={strokeWidth * 0.8} opacity={0.5} />
      <path d="M118,48 L118,42" strokeWidth={strokeWidth * 0.8} opacity={0.5} />
      <path d="M2,48 L118,48" strokeWidth={strokeWidth * 0.3} opacity={0.25} />
      <text x="60" y="55" textAnchor="middle" fill={color} fontSize="7" opacity={0.4} fontFamily="serif">165km</text>
    </svg>
  )
}

/** 朝天门长江大桥：钢桁拱 */
function ChaoTianMenSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 上层公路桥面 */}
      <path d="M8,24 L112,24" strokeWidth={strokeWidth} />
      {/* 下层轨道 */}
      <path d="M14,34 L106,34" strokeWidth={strokeWidth * 0.6} opacity={0.4} />
      {/* 钢桁拱（大抛物线弧） */}
      <path d="M16,24 Q60,-6 104,24" strokeWidth={strokeWidth * 1.3} />
      {/* 拱下支撑 */}
      {[24, 38, 52, 68, 82, 96].map((x) => (
        <path key={x} d={`M${x},24 L${x},30`} strokeWidth={strokeWidth * 0.5} opacity={0.3} />
      ))}
      {/* 拱顶标注 */}
      <text x="60" y="10" textAnchor="middle" fill={color} fontSize="7" opacity={0.4} fontFamily="serif">552m</text>
    </svg>
  )
}

/** 天峨龙滩特大桥：宽大抛物线拱 */
function TianESketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 桥面 */}
      <path d="M10,28 L110,28" strokeWidth={strokeWidth} />
      {/* 主拱（宽大的抛物线）*/}
      <path d="M14,28 Q60,-8 106,28" strokeWidth={strokeWidth * 1.5} />
      {/* 拱肋上弦 */}
      <path d="M20,28 Q60,-2 100,28" strokeWidth={strokeWidth * 0.5} opacity={0.3} />
      {/* 竖腹杆 */}
      {[24, 36, 48, 60, 72, 84, 96].map((x) => {
        const h0 = 28 - (28 - (-8)) * (1 - Math.pow((x - 14) / 92 - 0.5, 2) * 4)
        return <path key={x} d={`M${x},28 L${x},${h0}`} strokeWidth={strokeWidth * 0.4} opacity={0.3} />
      })}
      {/* 跨径标注 */}
      <text x="60" y="10" textAnchor="middle" fill={color} fontSize="7" opacity={0.4} fontFamily="serif">600m</text>
    </svg>
  )
}

/** 常泰长江大桥：三塔斜拉 */
function ChangTaiSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左塔 */}
      <path d="M20,8 L20,42" strokeWidth={strokeWidth * 1.8} />
      {/* 中塔（略高） */}
      <path d="M60,4 L60,42" strokeWidth={strokeWidth * 1.8} />
      {/* 右塔 */}
      <path d="M100,8 L100,42" strokeWidth={strokeWidth * 1.8} />
      {/* 桥面 */}
      <path d="M6,26 L114,26" strokeWidth={strokeWidth} />
      {/* 斜拉索（左塔） */}
      {[0, 1, 2, 3].map((i) => (
        <path key={`ctl-${i}`} d={`M20,${12 + i * 4} L${8 + i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path key={`ctr-${i}`} d={`M20,${12 + i * 4} L${32 + i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
      {/* 斜拉索（中塔） */}
      {[0, 1, 2, 3].map((i) => (
        <path key={`cml-${i}`} d={`M60,${8 + i * 4} L${40 + i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path key={`cmr-${i}`} d={`M60,${8 + i * 4} L${80 - i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
      {/* 斜拉索（右塔） */}
      {[0, 1, 2, 3].map((i) => (
        <path key={`crl-${i}`} d={`M100,${12 + i * 4} L${88 - i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path key={`crr-${i}`} d={`M100,${12 + i * 4} L${112 - i * 5},26`} strokeWidth={strokeWidth * 0.35} opacity={0.3} />
      ))}
    </svg>
  )
}

/** 港珠澳大桥：曲线 + 人工岛 */
function GangZhuAoSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左侧引桥 */}
      <path d="M6,30 L24,30" strokeWidth={strokeWidth} />
      {/* S形弯曲主桥 */}
      <path d="M24,30 C40,30 44,18 60,24 C76,30 80,20 96,30 L114,30" strokeWidth={strokeWidth * 1.2} />
      {/* 人工岛（椭圆凸起） */}
      <ellipse cx="30" cy="27" rx="6" ry="4" fill={color} opacity={0.15} strokeWidth={strokeWidth * 0.7} />
      <ellipse cx="90" cy="27" rx="6" ry="4" fill={color} opacity={0.15} strokeWidth={strokeWidth * 0.7} />
      {/* 隧道虚线（中间） */}
      <path d="M38,36 Q60,34 82,36" strokeWidth={strokeWidth * 0.5} opacity={0.3} strokeDasharray="3 3" />
      {/* 塔桥标记 */}
      <path d="M52,24 L52,14" strokeWidth={strokeWidth * 0.8} opacity={0.4} />
      <path d="M68,24 L68,14" strokeWidth={strokeWidth * 0.8} opacity={0.4} />
    </svg>
  )
}

/** 花江峡谷大桥：高塔 + 弧形拉索 */
function HuaJiangSketch({ color = SKETCH_COLOR, strokeWidth = 1.5, size = 120 }: { color?: string; strokeWidth?: number; size?: number }) {
  const s = size
  const h = s * 0.5
  return (
    <svg width={s} height={h} viewBox="0 0 120 60" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      {/* 左塔（极高） */}
      <path d="M24,4 L24,44" strokeWidth={strokeWidth * 2} />
      {/* 右塔 */}
      <path d="M96,4 L96,44" strokeWidth={strokeWidth * 2} />
      {/* 主缆（弧形） */}
      <path d="M24,10 Q60,22 96,10" strokeWidth={strokeWidth} />
      {/* 桥面 */}
      <path d="M10,28 L24,28" strokeWidth={strokeWidth * 0.8} />
      <path d="M24,28 L96,28" strokeWidth={strokeWidth} />
      <path d="M96,28 L110,28" strokeWidth={strokeWidth * 0.8} />
      {/* 吊杆 */}
      {[32, 40, 48, 56, 60, 64, 72, 80, 88].map((x) => (
        <path key={x} d={`M${x},${16 + Math.abs(x - 60) * 0.02} L${x},28`} strokeWidth={strokeWidth * 0.4} opacity={0.35} />
      ))}
      {/* 峡谷示意 */}
      <path d="M24,44 Q60,54 96,44" strokeWidth={strokeWidth * 0.6} opacity={0.25} />
    </svg>
  )
}

/* ══════════════════════════════════════════════
   桥 ID → 简笔画映射
   ══════════════════════════════════════════════ */
const SKETCH_MAP: Record<string, ({ color, strokeWidth, size }: { color?: string; strokeWidth?: number; size?: number }) => JSX.Element> = {
  zhaozhou: ZhaoZhouSketch,
  baodai: BaoDaiSketch,
  lugou: LuGouSketch,
  'chengyang-yongji': ChengYangSketch,
  luding: LuDingSketch,
  guangji: GuangJiSketch,
  'luoyang-bridge': LuoYangSketch,
  anping: AnPingSketch,
  wuting: WuTingSketch,
  shiqikong: ShiQiKongSketch,
  'gangzhu-ao': GangZhuAoSketch,
  'yuzhao-feiliang': YuZhaoSketch,
  jiangdong: JiangDongSketch,
  'wuhan-changjiang': WuHanSketch,
  beipanjiang: BeiPanJiangSketch,
  dankun: DanKunSketch,
  chaotianmen: ChaoTianMenSketch,
  'tiane-longtan': TianESketch,
  changtai: ChangTaiSketch,
  'huajiang-xiagu': HuaJiangSketch,
}

/* ══════════════════════════════════════════════
   公共组件
   ══════════════════════════════════════════════ */

interface Props {
  bridge: Bridge
  color?: string
  strokeWidth?: number
  size?: number
}

export default function BridgeSketch({ bridge, color, strokeWidth, size }: Props) {
  const Renderer = SKETCH_MAP[bridge.id]
  if (!Renderer) {
    // fallback: 桥名首字
    return (
      <div style={{
        width: size || 120,
        height: (size || 120) * 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'汇文明朝体', serif",
        fontSize: (size || 120) * 0.18,
        color: color || SKETCH_COLOR,
        opacity: 0.35,
        letterSpacing: 4,
      }}>
        {bridge.name}
      </div>
    )
  }
  return <Renderer color={color} strokeWidth={strokeWidth} size={size} />
}
