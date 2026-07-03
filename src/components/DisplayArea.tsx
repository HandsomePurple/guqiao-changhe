import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Sparkles, Box } from 'lucide-react';
import { useBridgeStore } from '../store/bridgeStore';
import type { DisplayState } from '../types/bridge';

/**
 * 桥梁详情页DisplayArea组件
 * 左侧60%宽度
 * 三态切换按钮组(场景图、粒子模型、3D模型)
 * 场景图:显示桥梁实景图片
 * 3D模型区域(暂时用占位符,后续集成Three.js)
 */
const DisplayArea = () => {
  const { id } = useParams<{ id: string }>();
  const { bridges, displayState, setDisplayState, selectBridgeById, selectedBridge, loadBridges } =
    useBridgeStore();
  const [imageLoaded, setImageLoaded] = useState(false);

  // 加载桥梁数据
  useEffect(() => {
    loadBridges();
  }, [loadBridges]);

  // 根据URL参数选择桥梁
  useEffect(() => {
    if (id && bridges.length > 0) {
      selectBridgeById(id);
    }
  }, [id, bridges, selectBridgeById]);

  // 加载状态
  useEffect(() => {
    setImageLoaded(false);
  }, [selectedBridge, displayState]);

  // 显示状态选项
  const displayOptions: { state: DisplayState; icon: React.ReactNode; label: string }[] = [
    { state: 'scene', icon: <Image className="h-5 w-5" />, label: '场景图' },
    { state: 'particle', icon: <Sparkles className="h-5 w-5" />, label: '粒子模型' },
    { state: '3d', icon: <Box className="h-5 w-5" />, label: '3D模型' },
  ];

  if (!selectedBridge) {
    return (
      <div className="h-full w-[60%] flex items-center justify-center bg-morandi-paperLight">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-morandi-primary/10 flex items-center justify-center mb-4 mx-auto">
            <Box className="h-10 w-10 text-morandi-primary" />
          </div>
          <p className="text-morandi-inkLight">请选择一座桥梁查看详情</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full w-[60%] flex flex-col bg-morandi-paperLight overflow-hidden">
      {/* 三态切换按钮组 */}
      <div className="px-6 py-4 border-b border-morandi-primary/10">
        <div className="flex items-center justify-between">
          {/* 桥梁名称 */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-morandi-ink">
              {selectedBridge.name}
            </h2>
            {selectedBridge.alias && (
              <p className="text-sm text-morandi-primary mt-1">{selectedBridge.alias}</p>
            )}
          </div>

          {/* 切换按钮组 */}
          <div className="flex items-center gap-1 rounded-lg bg-morandi-paper/50 p-1">
            {displayOptions.map((item) => (
              <motion.button
                key={item.state}
                onClick={() => setDisplayState(item.state)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 transition-all ${
                  displayState === item.state
                    ? 'bg-morandi-red text-morandi-paper'
                    : 'text-morandi-ink hover:bg-morandi-warmLight/30'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* 显示区域 */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* 场景图 */}
          {displayState === 'scene' && (
            <motion.div
              key="scene"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center p-8"
            >
              {/* 图片容器 */}
              <div className="relative w-full h-full rounded-lg overflow-hidden shadow-bridge">
                {/* 加载状态 */}
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-morandi-paper">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-morandi-primary/20 border-t-morandi-red rounded-full"
                    />
                  </div>
                )}

                {/* 桥梁场景图片 */}
                <img
                  src={selectedBridge.media.sceneImage}
                  alt={selectedBridge.name}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                />

                {/* 水墨效果覆盖层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-morandi-ink/10 via-transparent to-transparent opacity-30" />
              </div>
            </motion.div>
          )}

          {/* 粒子模型 */}
          {displayState === 'particle' && (
            <motion.div
              key="particle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-morandi-teal to-morandi-primary flex items-center justify-center mb-6 mx-auto shadow-bridge"
                  animate={{
                    scale: [1, 1.05, 1],
                    boxShadow: [
                      '0 8px 16px rgba(125, 157, 156, 0.2)',
                      '0 12px 24px rgba(125, 157, 156, 0.3)',
                      '0 8px 16px rgba(125, 157, 156, 0.2)',
                    ],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Sparkles className="h-16 w-16 text-morandi-paper" />
                </motion.div>
                <h3 className="font-serif text-xl font-bold text-morandi-ink mb-2">
                  粒子模型展示
                </h3>
                <p className="text-morandi-inkLight">粒子效果将在此区域展示</p>
                <p className="text-sm text-morandi-primary/50 mt-2">后续集成粒子系统</p>
              </div>
            </motion.div>
          )}

          {/* 3D模型 */}
          {displayState === '3d' && (
            <motion.div
              key="3d"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-morandi-warm to-morandi-warmDark flex items-center justify-center mb-6 mx-auto shadow-bridge"
                  animate={{
                    rotateY: [0, 360],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Box className="h-16 w-16 text-morandi-ink" />
                </motion.div>
                <h3 className="font-serif text-xl font-bold text-morandi-ink mb-2">
                  3D模型展示
                </h3>
                <p className="text-morandi-inkLight">Three.js 3D模型将在此区域展示</p>
                <p className="text-sm text-morandi-primary/50 mt-2">后续集成Three.js</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部装饰 */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-morandi-red/30 to-transparent" />
    </div>
  );
};

export default DisplayArea;