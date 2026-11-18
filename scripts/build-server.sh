#!/usr/bin/env bash
# 本地打包，不连接服务器；不改动 GitHub Pages 的 dist 目录。
set -euo pipefail
cd "$(dirname "$0")/.."

# 打包无需调试，避免 VSCode 自动附加让 npm / vue-tsc 等待调试器断开。
# 仅清理当前脚本和子进程的环境，不影响开发调试配置。
unset NODE_OPTIONS VSCODE_INSPECTOR_OPTIONS

echo '[1/2] 构建服务器版前端'
npm run typecheck
npm exec -- vite build --outDir dist-server
test -s dist-server/index.html

echo '[2/2] 生成手动上传包'
mkdir -p outputs/server
archive_tmp="$(mktemp "$PWD/outputs/server/.wenjiang-frontend.XXXXXX")"
trap 'rm -f "$archive_tmp"' EXIT
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive_tmp" -C dist-server .
mv -f "$archive_tmp" outputs/server/wenjiang-frontend.tar.gz
cp scripts/deploy.sh scripts/wenjiang-frontend.nginx.conf outputs/server/
echo "打包完成：$PWD/outputs/server"
echo '上传该目录中的三个文件至 root@156.238.249.157:/data/wenjiang/frontend/'
echo '在服务器执行：sh /data/wenjiang/frontend/deploy.sh'
