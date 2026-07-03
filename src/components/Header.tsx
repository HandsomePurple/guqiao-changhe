import { motion } from 'framer-motion';

/**
 * 首页Header组件
 * 显示"长河桥影"品牌标识
 * 使用思源宋体,朱砂红装饰线,云纹装饰SVG图案
 */
const Header = () => {
  return (
    <header className="relative h-20 overflow-hidden bg-gradient-to-r from-morandi-paper via-morandi-paperLight to-morandi-paper">
      {/* 水墨渐变背景 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-b from-morandi-ink/5 via-transparent to-morandi-ink/5" />
      </div>

      {/* 云纹装饰 - 左侧 */}
      <motion.div
        className="absolute left-8 top-1/2 -translate-y-1/2 opacity-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 0.2, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
          <path
            d="M50 10 C 30 10, 10 30, 10 50 C 10 70, 30 90, 50 90 C 70 90, 90 70, 90 50 C 90 30, 70 10, 50 10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="text-morandi-primary"
          />
          <path
            d="M50 20 C 35 20, 20 35, 20 50 C 20 65, 35 80, 50 80 C 65 80, 80 65, 80 50 C 80 35, 65 20, 50 20"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            className="text-morandi-warm"
          />
          <path
            d="M30 40 Q 40 30, 50 40 T 70 40"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            className="text-morandi-ink"
            opacity="0.5"
          />
        </svg>
      </motion.div>

      {/* 云纹装饰 - 右侧 */}
      <motion.div
        className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 0.2, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
          <path
            d="M50 10 C 30 10, 10 30, 10 50 C 10 70, 30 90, 50 90 C 70 90, 90 70, 90 50 C 90 30, 70 10, 50 10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="text-morandi-primary"
          />
          <path
            d="M50 20 C 35 20, 20 35, 20 50 C 20 65, 35 80, 50 80 C 65 80, 80 65, 80 50 C 80 35, 65 20, 50 20"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            className="text-morandi-warm"
          />
          <path
            d="M30 60 Q 40 70, 50 60 T 70 60"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            className="text-morandi-ink"
            opacity="0.5"
          />
        </svg>
      </motion.div>

      {/* 主要内容 */}
      <div className="relative z-10 flex h-full items-center justify-center">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* 朱砂红装饰线 - 上 */}
          <motion.div
            className="h-0.5 w-32 bg-gradient-to-r from-transparent via-morandi-red to-transparent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* 品牌标识 */}
          <h1 className="font-serif text-4xl font-bold tracking-widest text-morandi-ink my-2">
            长河桥影
          </h1>

          {/* 朱砂红装饰线 - 下 */}
          <motion.div
            className="h-0.5 w-32 bg-gradient-to-r from-transparent via-morandi-red to-transparent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
        </motion.div>
      </div>

      {/* 装饰性水墨点 */}
      <motion.div
        className="absolute left-1/4 top-1/3 h-1 w-1 rounded-full bg-morandi-ink opacity-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute right-1/4 bottom-1/3 h-1 w-1 rounded-full bg-morandi-ink opacity-10"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
    </header>
  );
};

export default Header;