import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useBridgeStore } from '../store/bridgeStore';
import type { Bridge } from '../types/bridge';

/**
 * 桥梁列表组件
 * 右侧固定宽度300px
 * 显示所有桥梁名称列表
 * 支持搜索筛选
 * 悬停效果:左侧朱砂红竖线
 * 点击跳转到详情页
 */
const BridgeList = () => {
  const navigate = useNavigate();
  const { bridges, searchQuery, setSearchQuery, selectedType, loadBridges } = useBridgeStore();
  const [localSearch, setLocalSearch] = useState('');

  // 加载桥梁数据
  useEffect(() => {
    loadBridges();
  }, [loadBridges]);

  // 同步本地搜索到store
  useEffect(() => {
    setSearchQuery(localSearch);
  }, [localSearch, setSearchQuery]);

  // 过滤桥梁列表
  const filteredBridges = bridges.filter((bridge) => {
    // 搜索过滤
    const matchSearch =
      localSearch === '' ||
      bridge.name.toLowerCase().includes(localSearch.toLowerCase()) ||
      bridge.alias?.toLowerCase().includes(localSearch.toLowerCase()) ||
      bridge.location.province.includes(localSearch) ||
      bridge.location.city.includes(localSearch);

    // 类型过滤
    const matchType = selectedType === 'all' || bridge.type === selectedType;

    return matchSearch && matchType;
  });

  // 处理桥梁点击
  const handleBridgeClick = (bridgeId: string) => {
    navigate(`/bridge/${bridgeId}`);
  };

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

  return (
    <div className="h-full w-[300px] bg-morandi-paperLight overflow-hidden flex flex-col border-l border-morandi-primary/10">
      {/* 搜索区域 */}
      <div className="p-4 border-b border-morandi-primary/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-morandi-primary" />
          <input
            type="text"
            placeholder="搜索桥梁..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-morandi-primary/20 bg-morandi-paper text-morandi-ink placeholder-morandi-primary/50 focus:outline-none focus:border-morandi-red transition-colors"
          />
        </div>
      </div>

      {/* 桥梁数量统计 */}
      <div className="px-4 py-2 bg-morandi-paper/50">
        <p className="text-sm text-morandi-inkLight">
          共 <span className="font-semibold text-morandi-ink">{filteredBridges.length}</span> 座桥梁
        </p>
      </div>

      {/* 桥梁列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredBridges.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center p-8"
          >
            <div className="w-16 h-16 rounded-full bg-morandi-primary/10 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-morandi-primary" />
            </div>
            <p className="text-morandi-inkLight">未找到匹配的桥梁</p>
            <p className="text-sm text-morandi-primary/50 mt-2">请尝试其他搜索词</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1"
          >
            {filteredBridges.map((bridge, index) => (
              <motion.div
                key={bridge.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleBridgeClick(bridge.id)}
                className="group relative cursor-pointer rounded-lg px-3 py-3 transition-all duration-300 hover:bg-morandi-warmLight/30"
              >
                {/* 悬停时的朱砂红竖线 */}
                <motion.div
                  className="absolute left-0 top-0 h-full w-1 bg-morandi-red rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ scaleY: 0 }}
                  whileHover={{ scaleY: 1 }}
                  transition={{ duration: 0.2 }}
                />

                {/* 桥梁信息 */}
                <div className="pl-2">
                  <h3 className="font-serif font-bold text-morandi-ink group-hover:text-morandi-red transition-colors">
                    {bridge.name}
                  </h3>
                  {bridge.alias && (
                    <p className="text-sm text-morandi-primary/60 mt-0.5">{bridge.alias}</p>
                  )}

                  {/* 地点和年代 */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-morandi-inkLight">
                    <span className="flex items-center">
                      <span className="mr-1">📍</span>
                      {bridge.location.province}
                    </span>
                    <span className="flex items-center">
                      <span className="mr-1">📅</span>
                      {bridge.builtYear}年
                    </span>
                  </div>

                  {/* 桥梁类型标签 */}
                  <div className="mt-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-morandi-primary/10 text-morandi-primary">
                      {getBridgeTypeLabel(bridge.type)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* 底部装饰 */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-morandi-red/30 to-transparent" />
    </div>
  );
};

export default BridgeList;