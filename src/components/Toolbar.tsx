import { motion } from 'framer-motion';
import {
  Globe,
  ZoomIn,
  Compass,
  MapPin,
  Mountain,
  Layers,
  Link2,
  Anchor,
  Home,
  Clock,
} from 'lucide-react';
import { useBridgeStore } from '../store/bridgeStore';
import type { ViewType, BridgeType } from '../types/bridge';

/**
 * 底部工具栏组件
 * 视角切换图标组(全局、局部、东部、南部)
 * 桥梁分类图标组(拱桥、梁桥、索桥、浮桥、廊桥)
 * 技术发展时间轴按钮
 */
const Toolbar = () => {
  const { viewType, setViewType, selectedType, setSelectedType, showTimeline, setShowTimeline } =
    useBridgeStore();

  // 视角类型数据
  const viewTypes: { type: ViewType; icon: React.ReactNode; label: string }[] = [
    { type: 'global', icon: <Globe className="h-5 w-5" />, label: '全局' },
    { type: 'detail', icon: <ZoomIn className="h-5 w-5" />, label: '局部' },
    { type: 'east', icon: <Compass className="h-5 w-5" />, label: '东部' },
    { type: 'south', icon: <MapPin className="h-5 w-5" />, label: '南部' },
  ];

  // 桥梁分类数据
  const bridgeTypes: { type: BridgeType | 'all'; icon: React.ReactNode; label: string }[] = [
    { type: 'all', icon: <Layers className="h-5 w-5" />, label: '全部' },
    { type: 'arch', icon: <Mountain className="h-5 w-5" />, label: '拱桥' },
    { type: 'beam', icon: <Home className="h-5 w-5" />, label: '梁桥' },
    { type: 'suspension', icon: <Link2 className="h-5 w-5" />, label: '索桥' },
    { type: 'floating', icon: <Anchor className="h-5 w-5" />, label: '浮桥' },
    { type: 'covered', icon: <Home className="h-5 w-5" />, label: '廊桥' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-morandi-paper/95 backdrop-blur-md border-t border-morandi-primary/10">
      <div className="flex items-center justify-between px-6 py-3">
        {/* 视角切换组 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-morandi-inkLight mr-3">视角</span>
          <div className="flex items-center gap-1 rounded-lg bg-morandi-paperLight/50 p-1">
            {viewTypes.map((item) => (
              <motion.button
                key={item.type}
                onClick={() => setViewType(item.type)}
                className={`relative flex items-center gap-2 rounded-md px-3 py-2 transition-all ${
                  viewType === item.type
                    ? 'bg-morandi-red text-morandi-paper'
                    : 'text-morandi-ink hover:bg-morandi-warmLight/30'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
                {/* 激活状态下的朱砂红装饰 */}
                {viewType === item.type && (
                  <motion.div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-morandi-paperLight"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 桥梁分类组 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-morandi-inkLight mr-3">分类</span>
          <div className="flex items-center gap-1 rounded-lg bg-morandi-paperLight/50 p-1">
            {bridgeTypes.map((item) => (
              <motion.button
                key={item.type}
                onClick={() => setSelectedType(item.type)}
                className={`relative flex items-center gap-2 rounded-md px-3 py-2 transition-all ${
                  selectedType === item.type
                    ? 'bg-morandi-primary text-morandi-paper'
                    : 'text-morandi-ink hover:bg-morandi-warmLight/30'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
                {/* 激活状态下的装饰 */}
                {selectedType === item.type && (
                  <motion.div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-morandi-paperLight"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 技术发展时间轴按钮 */}
        <motion.button
          onClick={() => setShowTimeline(!showTimeline)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
            showTimeline
              ? 'bg-morandi-teal text-morandi-paper'
              : 'bg-morandi-paperLight/50 text-morandi-ink hover:bg-morandi-warmLight/30'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Clock className="h-5 w-5" />
          <span className="text-sm font-medium">技术时间轴</span>
          {/* 朱砂红装饰点 */}
          <motion.div
            className="ml-1 h-1.5 w-1.5 rounded-full bg-morandi-red"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.button>
      </div>

      {/* 水墨装饰线 */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-morandi-red/30 to-transparent" />
    </div>
  );
};

export default Toolbar;