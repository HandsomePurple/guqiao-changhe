import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBridgeStore } from '../store/bridgeStore';
import type { Bridge, ViewType, HoverCardData } from '../types/bridge';

/**
 * 地图检索区组件
 * 显示中国地图(Canvas绘制)
 * 桥梁位置标注点(呼吸动画)
 * 悬停显示信息卡片
 * 支持视角切换
 */
const MapContainer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { bridges, viewType, loadBridges } = useBridgeStore();
  const [hoveredBridge, setHoveredBridge] = useState<HoverCardData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 加载桥梁数据
  useEffect(() => {
    loadBridges();
  }, [loadBridges]);

  // 绘制简化中国地图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制水墨背景
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    gradient.addColorStop(0, '#F5F1ED');
    gradient.addColorStop(1, '#EAE6E2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制简化的中国地图轮廓
    drawChinaMap(ctx, canvas.width, canvas.height, viewType);

    // 绘制河流
    drawRivers(ctx, canvas.width, canvas.height);
  }, [viewType]);

  // 根据视角类型调整地图显示
  const drawChinaMap = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    viewType: ViewType
  ) => {
    ctx.save();

    // 根据视角设置不同的透明度和样式
    const opacity = viewType === 'detail' ? 0.3 : 0.6;
    ctx.globalAlpha = opacity;

    // 设置线条样式 - 水墨效果
    ctx.strokeStyle = '#8B9A9B';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 绘制简化的中国地图轮廓点
    const chinaOutline = [
      [0.15, 0.15], [0.25, 0.1], [0.4, 0.08], [0.55, 0.1], [0.65, 0.15],
      [0.75, 0.18], [0.82, 0.22], [0.88, 0.3], [0.9, 0.4], [0.85, 0.5],
      [0.82, 0.58], [0.78, 0.65], [0.72, 0.7], [0.65, 0.72], [0.55, 0.7],
      [0.48, 0.68], [0.42, 0.7], [0.35, 0.68], [0.28, 0.65], [0.22, 0.6],
      [0.18, 0.52], [0.15, 0.45], [0.12, 0.38], [0.1, 0.3], [0.12, 0.22],
    ];

    ctx.beginPath();
    chinaOutline.forEach((point, index) => {
      const x = point[0] * width;
      const y = point[1] * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    // 填充半透明色
    ctx.fillStyle = 'rgba(139, 154, 155, 0.08)';
    ctx.fill();

    // 绘制省份分隔线
    ctx.strokeStyle = 'rgba(139, 154, 155, 0.3)';
    ctx.lineWidth = 0.5;
    drawProvinceBorders(ctx, width, height, viewType);

    ctx.restore();
  };

  // 绘制省份分隔线
  const drawProvinceBorders = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    viewType: ViewType
  ) => {
    // 东部视角
    if (viewType === 'east') {
      ctx.beginPath();
      ctx.moveTo(width * 0.7, height * 0.15);
      ctx.lineTo(width * 0.7, height * 0.75);
      ctx.stroke();
    }
    // 南部视角
    else if (viewType === 'south') {
      ctx.beginPath();
      ctx.moveTo(width * 0.15, height * 0.6);
      ctx.lineTo(width * 0.85, height * 0.6);
      ctx.stroke();
    }
  };

  // 绘制河流
  const drawRivers = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(125, 157, 156, 0.2)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // 长江
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * 0.52);
    ctx.bezierCurveTo(
      width * 0.3,
      height * 0.5,
      width * 0.5,
      height * 0.55,
      width * 0.85,
      height * 0.52
    );
    ctx.stroke();

    // 黄河
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * 0.38);
    ctx.bezierCurveTo(
      width * 0.35,
      height * 0.35,
      width * 0.55,
      height * 0.42,
      width * 0.75,
      height * 0.38
    );
    ctx.stroke();

    ctx.restore();
  };

  // 将经纬度转换为画布坐标
  const coordinatesToPosition = (coords: [number, number]) => {
    const [lng, lat] = coords;
    // 中国经纬度范围大约: 东经73-135, 北纬18-54
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const x = ((lng - 73) / (135 - 73)) * canvas.width * 0.9 + canvas.width * 0.05;
    const y = ((54 - lat) / (54 - 18)) * canvas.height * 0.85 + canvas.height * 0.08;

    return { x, y };
  };

  // 处理标注点悬停
  const handleMarkerHover = (bridge: Bridge, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHoveredBridge({
      id: bridge.id,
      name: bridge.name,
      alias: bridge.alias,
      location: `${bridge.location.province} ${bridge.location.city}`,
      builtYear: bridge.builtYear,
      type: bridge.type,
      lineDrawing: bridge.media.lineDrawing,
    });
  };

  // 处理标注点点击
  const handleMarkerClick = (bridgeId: string) => {
    navigate(`/bridge/${bridgeId}`);
  };

  // 根据视角筛选桥梁
  const getFilteredBridges = () => {
    switch (viewType) {
      case 'east':
        // 东部桥梁
        return bridges.filter((b) => b.location.coordinates[0] > 110);
      case 'south':
        // 南部桥梁
        return bridges.filter((b) => b.location.coordinates[1] < 35);
      default:
        return bridges;
    }
  };

  const filteredBridges = getFilteredBridges();

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-morandi-paper shadow-bridge">
      {/* Canvas 地图 */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 桥梁标注点 */}
      {filteredBridges.map((bridge) => {
        const pos = coordinatesToPosition(bridge.location.coordinates);
        return (
          <motion.div
            key={bridge.id}
            className="absolute cursor-pointer"
            style={{ left: pos.x, top: pos.y }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: Math.random() * 0.3 }}
            onMouseEnter={(e) => handleMarkerHover(bridge, e)}
            onMouseLeave={() => setHoveredBridge(null)}
            onClick={() => handleMarkerClick(bridge.id)}
          >
            {/* 呼吸动画效果 */}
            <motion.div
              className="h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-morandi-red"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            {/* 外圈扩散效果 */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-morandi-red"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          </motion.div>
        );
      })}

      {/* 悬停信息卡片 */}
      <AnimatePresence>
        {hoveredBridge && (
          <motion.div
            className="pointer-events-none absolute z-20 w-64 rounded-lg bg-morandi-paperLight/95 p-4 shadow-bridge backdrop-blur-sm"
            style={{
              left: Math.min(mousePos.x + 20, 400),
              top: Math.max(mousePos.y - 100, 20),
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* 桥梁名称 */}
            <h3 className="font-serif text-lg font-bold text-morandi-ink">
              {hoveredBridge.name}
            </h3>
            {hoveredBridge.alias && (
              <p className="mt-0.5 text-sm text-morandi-primary">{hoveredBridge.alias}</p>
            )}

            {/* 基本信息 */}
            <div className="mt-3 space-y-1.5 text-sm text-morandi-inkLight">
              <p className="flex items-center">
                <span className="mr-2 text-morandi-primary">📍</span>
                {hoveredBridge.location}
              </p>
              <p className="flex items-center">
                <span className="mr-2 text-morandi-primary">📅</span>
                建于 {hoveredBridge.builtYear} 年
              </p>
            </div>

            {/* 桥梁类型标签 */}
            <div className="mt-3">
              <span className="rounded-full bg-morandi-primary/10 px-3 py-1 text-xs text-morandi-primary">
                {hoveredBridge.type === 'arch' && '拱桥'}
                {hoveredBridge.type === 'beam' && '梁桥'}
                {hoveredBridge.type === 'suspension' && '索桥'}
                {hoveredBridge.type === 'floating' && '浮桥'}
                {hoveredBridge.type === 'covered' && '廊桥'}
                {hoveredBridge.type === 'other' && '其他'}
              </span>
            </div>

            {/* 朱砂红装饰线 */}
            <div className="mt-3 h-0.5 w-full bg-gradient-to-r from-transparent via-morandi-red to-transparent opacity-30" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 视角标识 */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-morandi-paperLight/80 px-3 py-1.5 text-sm text-morandi-inkLight backdrop-blur-sm">
        {viewType === 'global' && '全国视角'}
        {viewType === 'detail' && '局部视角'}
        {viewType === 'east' && '东部视角'}
        {viewType === 'south' && '南部视角'}
      </div>
    </div>
  );
};

export default MapContainer;