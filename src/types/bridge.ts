export type BridgeType = 'arch' | 'beam' | 'suspension' | 'cable-stayed' | 'covered' | 'floating' | 'modern' | 'truss' | 'viaduct' | 'arch-steel'

/** 历史时期分组—用于时光长河 */
export type BridgePeriod = 'sui-tang' | 'song-yuan' | 'ming-qing' | 'modern'

export interface ViewingSpot {
  name: string
  desc: string
  tip?: string
}

/** 关键词 — 海报卡片底部点击展开详情 */
export interface BridgeKeyword {
  label: string     // e.g. "世界之最", "千年安固", "敞肩拱桥"
  content: string   // 对应的详细文字
}

export interface Bridge {
  id: string
  name: string
  type: BridgeType
  province: string
  city: string
  lat: number
  lng: number
  era: string           // e.g. "隋代", "宋代", "清代", "现代"
  year: string          // e.g. "605年"
  length: string        // e.g. "50.82米"
  material: string      // e.g. "石拱", "钢桁梁"
  /** 历史时期分组 */
  period: BridgePeriod
  description: string
  history: string
  features: string[]
  poems: { title: string; author: string; lines: string[] }[]
  viewingSpots: ViewingSpot[]
  // 海报关键词（赵州桥等有深度内容的桥）
  keywords?: BridgeKeyword[]
  // Particle model
  has3DModel: boolean
  modelPath?: string    // GLB/PLY path
  particleTexture?: string
  // Panorama
  panoramaPath?: string
  // 海报背景图
  posterImage?: string
  // 实景图（用于左右滑动切换）
  realImage?: string
  /** 技术指标 — 时光长河用 */
  maxSpan?: string      // 最大跨度 e.g. "37m", "1650m"
  maxHeight?: string    // 最大高度 e.g. "565m"
  maxLength?: string    // 最大长度 e.g. "165km"
  /** 文旅信息 */
  openingHours?: string   // 开放时间
  ticket?: string         // 门票信息
  nearbyAttractions?: string[]  // 周边景点
}
