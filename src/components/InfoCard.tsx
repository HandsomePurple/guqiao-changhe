import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Ruler, BookOpen, History, Cog } from 'lucide-react';
import { useBridgeStore } from '../store/bridgeStore';

/**
 * 桥梁信息卡组件
 * 右侧40%宽度
 * 显示桥梁详细信息
 * 基本信息(名称、地点、年代)
 * 尺寸数据(长度、宽度、高度、跨度)
 * 人文故事
 * 历史变迁时间轴
 * 关键技术特性
 */
const InfoCard = () => {
  const { id } = useParams<{ id: string }>();
  const { bridges, selectBridgeById, selectedBridge, loadBridges } = useBridgeStore();
  const [activeTab, setActiveTab] = useState<'info' | 'culture' | 'technology'>('info');

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

  // 获取桥梁类型标签
  const getBridgeTypeLabel = (type: string) => {
    switch (type) {
      case 'arch':
        return '拱桥';
      case 'beam':
        return '梁桥';
      case 'suspension':
        return '索桥';
      case 'floating':
        return '浮桥';
      case 'covered':
        return '廊桥';
      default:
        return '其他';
    }
  };

  if (!selectedBridge) {
    return (
      <div className="h-full w-[40%] flex items-center justify-center bg-morandi-paper border-l border-morandi-primary/10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-morandi-primary/10 flex items-center justify-center mb-4 mx-auto">
            <BookOpen className="h-10 w-10 text-morandi-primary" />
          </div>
          <p className="text-morandi-inkLight">选择桥梁查看详细信息</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full w-[40%] flex flex-col bg-morandi-paper overflow-hidden border-l border-morandi-primary/10">
      {/* 标签页切换 */}
      <div className="px-6 py-4 border-b border-morandi-primary/10">
        <div className="flex items-center gap-2">
          {[
            { key: 'info', label: '基本信息', icon: <MapPin className="h-4 w-4" /> },
            { key: 'culture', label: '人文故事', icon: <BookOpen className="h-4 w-4" /> },
            { key: 'technology', label: '技术特性', icon: <Cog className="h-4 w-4" /> },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'info' | 'culture' | 'technology')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-morandi-red text-morandi-paper'
                  : 'text-morandi-ink hover:bg-morandi-warmLight/30'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {tab.icon}
              <span className="text-sm font-medium">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 信息内容区 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AnimatePresence mode="wait">
          {/* 基本信息 */}
          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* 基本信息 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-morandi-red" />
                  基本信息
                </h3>

                <div className="space-y-3">
                  {/* 名称 */}
                  <div className="flex items-center justify-between py-2 border-b border-morandi-primary/10">
                    <span className="text-sm text-morandi-inkLight">桥梁名称</span>
                    <span className="font-medium text-morandi-ink">{selectedBridge.name}</span>
                  </div>

                  {/* 别名 */}
                  {selectedBridge.alias && (
                    <div className="flex items-center justify-between py-2 border-b border-morandi-primary/10">
                      <span className="text-sm text-morandi-inkLight">别名</span>
                      <span className="font-medium text-morandi-ink">{selectedBridge.alias}</span>
                    </div>
                  )}

                  {/* 地点 */}
                  <div className="flex items-center justify-between py-2 border-b border-morandi-primary/10">
                    <span className="text-sm text-morandi-inkLight">地点</span>
                    <span className="font-medium text-morandi-ink">
                      {selectedBridge.location.province} {selectedBridge.location.city}
                    </span>
                  </div>

                  {/* 建造年代 */}
                  <div className="flex items-center justify-between py-2 border-b border-morandi-primary/10">
                    <span className="text-sm text-morandi-inkLight flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      建造年代
                    </span>
                    <span className="font-medium text-morandi-ink">
                      {selectedBridge.builtYear}年
                    </span>
                  </div>

                  {/* 桥梁类型 */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-morandi-inkLight">桥梁类型</span>
                    <span className="rounded-full bg-morandi-primary/10 px-3 py-1 text-xs text-morandi-primary">
                      {getBridgeTypeLabel(selectedBridge.type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 尺寸数据 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4 flex items-center">
                  <Ruler className="h-5 w-5 mr-2 text-morandi-red" />
                  尺寸数据
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* 长度 */}
                  <div className="rounded-lg bg-morandi-paper p-3">
                    <div className="text-xs text-morandi-inkLight mb-1">长度</div>
                    <div className="text-xl font-display font-bold text-morandi-ink">
                      {selectedBridge.dimensions.length}
                      <span className="text-sm text-morandi-inkLight ml-1">米</span>
                    </div>
                  </div>

                  {/* 宽度 */}
                  <div className="rounded-lg bg-morandi-paper p-3">
                    <div className="text-xs text-morandi-inkLight mb-1">宽度</div>
                    <div className="text-xl font-display font-bold text-morandi-ink">
                      {selectedBridge.dimensions.width}
                      <span className="text-sm text-morandi-inkLight ml-1">米</span>
                    </div>
                  </div>

                  {/* 高度 */}
                  <div className="rounded-lg bg-morandi-paper p-3">
                    <div className="text-xs text-morandi-inkLight mb-1">高度</div>
                    <div className="text-xl font-display font-bold text-morandi-ink">
                      {selectedBridge.dimensions.height}
                      <span className="text-sm text-morandi-inkLight ml-1">米</span>
                    </div>
                  </div>

                  {/* 跨度 */}
                  <div className="rounded-lg bg-morandi-paper p-3">
                    <div className="text-xs text-morandi-inkLight mb-1">跨度</div>
                    <div className="text-xl font-display font-bold text-morandi-ink">
                      {selectedBridge.dimensions.span}
                      <span className="text-sm text-morandi-inkLight ml-1">米</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 人文故事 */}
          {activeTab === 'culture' && (
            <motion.div
              key="culture"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* 人文故事 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4 flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-morandi-red" />
                  人文故事
                </h3>

                <div className="space-y-3">
                  {selectedBridge.culture.stories.map((story, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="rounded-lg bg-morandi-paper p-3 border-l-2 border-morandi-red"
                    >
                      <p className="text-sm text-morandi-ink leading-relaxed">{story}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 历史变迁时间轴 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4 flex items-center">
                  <History className="h-5 w-5 mr-2 text-morandi-red" />
                  历史变迁
                </h3>

                <div className="relative space-y-4">
                  {/* 时间轴线 */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-morandi-red via-morandi-primary to-morandi-teal" />

                  {selectedBridge.culture.historicalChanges.map((change, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.15 }}
                      className="relative pl-10"
                    >
                      {/* 时间点 */}
                      <div className="absolute left-1.5 top-2 h-4 w-4 rounded-full bg-morandi-red border-2 border-morandi-paper" />

                      <div className="rounded-lg bg-morandi-paper p-3">
                        <p className="text-sm text-morandi-ink leading-relaxed">{change}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 保护级别 */}
              {selectedBridge.culture.protectionLevel && (
                <div className="rounded-lg bg-gradient-to-r from-morandi-red/10 to-morandi-teal/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-morandi-ink">保护级别</span>
                    <span className="rounded-full bg-morandi-red/20 px-3 py-1 text-xs font-medium text-morandi-red">
                      {selectedBridge.culture.protectionLevel}
                    </span>
                  </div>
                  {selectedBridge.culture.tourismInfo && (
                    <p className="mt-3 text-sm text-morandi-inkLight">
                      {selectedBridge.culture.tourismInfo}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* 技术特性 */}
          {activeTab === 'technology' && (
            <motion.div
              key="technology"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* 结构特征 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4 flex items-center">
                  <Cog className="h-5 w-5 mr-2 text-morandi-red" />
                  结构特征
                </h3>

                <div className="space-y-2">
                  {selectedBridge.technology.structuralFeatures.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2 rounded-lg bg-morandi-paper p-3"
                    >
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-morandi-teal" />
                      <p className="text-sm text-morandi-ink leading-relaxed">{feature}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 建筑材料 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4">建筑材料</h3>

                <div className="flex flex-wrap gap-2">
                  {selectedBridge.technology.materials.map((material, index) => (
                    <motion.span
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-full bg-morandi-warm/20 px-3 py-1 text-sm text-morandi-warmDark border border-morandi-warm/30"
                    >
                      {material}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* 技术创新 */}
              <div className="rounded-lg bg-morandi-paperLight/50 p-4">
                <h3 className="font-serif text-lg font-bold text-morandi-ink mb-4">技术创新</h3>

                <div className="space-y-3">
                  {selectedBridge.technology.innovations.map((innovation, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.15 }}
                      className="rounded-lg bg-gradient-to-r from-morandi-teal/10 to-morandi-primary/10 p-3 border-l-2 border-morandi-teal"
                    >
                      <p className="text-sm text-morandi-ink leading-relaxed">{innovation}</p>
                    </motion.div>
                  ))}
                </div>
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

export default InfoCard;