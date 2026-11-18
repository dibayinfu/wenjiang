#!/bin/sh
# 上传三个文件后，在 Linux 服务器执行：sh /data/wenjiang/frontend/deploy.sh
set -eu

deploy_dir=/data/wenjiang/frontend
archive="$deploy_dir/wenjiang-frontend.tar.gz"
current="$deploy_dir/current"
next="$deploy_dir/.current-$$"
previous_next="$deploy_dir/.previous-$$"
nginx_conf=/etc/nginx/conf.d/wenjiang-frontend.conf
created_conf=0
switched=0
success=0
previous=''

fail() { echo "错误：$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || fail '请以 root 执行。'
command -v nginx >/dev/null 2>&1 || fail '请先安装并启动 Nginx。'
command -v systemctl >/dev/null 2>&1 || fail '此脚本需要 systemd 管理 Nginx。'
[ -s "$archive" ] || fail "请先上传压缩包到 $archive"
for link in "$current" "$deploy_dir/previous"; do
    if [ -e "$link" ] && [ ! -L "$link" ]; then
        fail "$link 已存在且不是符号链接，请先确认目录。"
    fi
done

cleanup() {
    if [ "$success" -eq 0 ]; then
        if [ "$switched" -eq 1 ]; then
            if [ -n "$previous" ]; then
                rm -f "$next"
                ln -s "$previous" "$next"
                mv -Tf "$next" "$current"
                echo '发布未完成，已恢复上一版本。' >&2
            else
                rm -f "$current"
                echo '发布未完成，已撤销首次版本切换。' >&2
            fi
        fi
        if [ "$created_conf" -eq 1 ]; then rm -f "$nginx_conf"; fi
    fi
    rm -f "$next" "$previous_next"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

echo '[1/4] 解压并检查新版本'
mkdir -p "$deploy_dir/releases"
release_dir=$(mktemp -d "$deploy_dir/releases/$(date +%Y%m%d-%H%M%S)-XXXXXX")
tar -xzf "$archive" -C "$release_dir"
[ -s "$release_dir/index.html" ] || fail '压缩包根目录缺少 index.html，未切换版本。'
[ -d "$release_dir/assets" ] || fail '压缩包缺少 assets 目录，未切换版本。'
chmod -R a+rX "$release_dir"

echo '[2/4] 检查 Nginx 配置'
if [ ! -e "$nginx_conf" ]; then
    [ -s "$deploy_dir/wenjiang-frontend.nginx.conf" ] || fail '首次部署需要上传 wenjiang-frontend.nginx.conf。'
    mkdir -p /etc/nginx/conf.d
    cp "$deploy_dir/wenjiang-frontend.nginx.conf" "$nginx_conf"
    created_conf=1
fi
nginx -t

echo '[3/4] 切换版本'
previous=$(readlink "$current" || true)
ln -s "$release_dir" "$next"
mv -Tf "$next" "$current"
switched=1

echo '[4/4] 平滑重载 Nginx'
systemctl reload nginx
success=1
if [ -n "$previous" ]; then
    ln -s "$previous" "$previous_next"
    mv -Tf "$previous_next" "$deploy_dir/previous"
    echo "上一版本：$previous"
fi
echo "发布成功：$release_dir"
echo '访问地址：http://156.238.249.157/#/tools/collection-coordinates'
