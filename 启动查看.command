#!/bin/bash
cd "$(dirname "$0")/dist"
echo "正在启动古桥·长河展示服务器..."
echo "请稍候，浏览器即将自动打开..."
python3 -m http.server 8080 &
sleep 2
open "http://localhost:8080"
echo "服务器已启动，按回车键关闭"
read
kill %1
