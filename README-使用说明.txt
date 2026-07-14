古桥·长河 2.0 - 使用说明
========================

【注意】本项目为现代前端工程（React + Vite + Three.js），
必须借助本地服务器才能正常运行，直接双击 index.html 会显示空白页。

【macOS 用户 - 推荐方式】
双击 "启动查看.command" 文件，会自动启动服务器并在浏览器中打开页面。

【通用方式 - 命令行启动】
1. 打开终端
2. cd 进入 dist 文件夹
3. 执行以下任一命令：

   python3 -m http.server 8080
   （然后在浏览器访问 http://localhost:8080）

   或

   npx serve .

【Windows 用户】
在 dist 文件夹内打开 PowerShell，执行：
   python -m http.server 8080

【技术栈】
React 18 + TypeScript + Three.js + React Three Fiber + Vite

【项目特点】
- 3D 粒子交互桥梁展示
- 时光长河：桥梁技术发展历程
- 交互式 3D 地图：150+ 座桥梁分布
- 实景图与场景图滑动切换
