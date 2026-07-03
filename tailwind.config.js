/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 莫兰迪配色方案 - 桥梁文化主题
        morandi: {
          // 主色调 - 青灰色(象征古老桥梁的青石质感)
          primary: '#8B9A9B',
          primaryLight: '#A8B5B6',
          primaryDark: '#6F8081',

          // 暖米色 - 温润的古典气息
          warm: '#D4C5B9',
          warmLight: '#E0D3C8',
          warmDark: '#C0B1A5',

          // 朱砂红 - 传统中国红点缀
          red: '#C8553D',
          redLight: '#D76650',
          redDark: '#B94432',

          // 墨灰色 - 水墨画般的沉稳
          ink: '#4A4A4A',
          inkLight: '#636363',
          inkDark: '#333333',

          // 青绿色 - 江南水乡的意境
          teal: '#7D9D9C',
          tealLight: '#8DB3B2',
          tealDark: '#6D8786',

          // 米白色 - 宣纸般的质感(背景色)
          paper: '#F5F1ED',
          paperLight: '#FAF8F5',
          paperDark: '#EAE6E2',
        },
      },
      fontFamily: {
        // 标题字体 - 传统书法韵味
        serif: ['Noto Serif SC', '思源宋体', 'serif'],
        // 正文字体 - 清晰易读
        sans: ['Noto Sans SC', '思源黑体', 'sans-serif'],
        // 数字字体 - 优雅的数据展示
        display: ['DM Serif Display', 'serif'],
      },
      backgroundImage: {
        // 水墨晕染效果
        'ink-gradient': 'linear-gradient(135deg, rgba(74,74,74,0) 0%, rgba(74,74,74,0.1) 50%, rgba(74,74,74,0) 100%)',
        'paper-texture': 'radial-gradient(circle at 20% 50%, rgba(245,241,237,1) 0%, rgba(234,230,226,1) 100%)',
      },
      boxShadow: {
        'bridge': '0 8px 16px rgba(74, 74, 74, 0.12), 0 4px 8px rgba(139, 154, 155, 0.08)',
        'bridge-hover': '0 12px 24px rgba(74, 74, 74, 0.16), 0 6px 12px rgba(139, 154, 155, 0.12)',
        'card': '0 4px 12px rgba(74, 74, 74, 0.08)',
      },
      animation: {
        'breathe': 'breathe 3s ease-in-out infinite',
        'ripple': 'ripple 0.6s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
