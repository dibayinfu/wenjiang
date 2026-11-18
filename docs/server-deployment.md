# 温江前端服务器部署

沿用 longan 的本地打包、手动上传、服务器切换版本流程。GitHub Pages 工作流不变，仍使用 `npm run build` 和 `dist/`。服务器版单独生成 `dist-server/` 和 `outputs/server/`，无需 Java 后端或服务器端 Node.js。

## 本地打包

在 VSCode 的 Run and Debug 中选择 **温江前端：打包服务器版（手动上传）**，点击运行。也可在项目根目录执行：

```sh
npm run build:server
```

首次使用先执行 `npm ci`。构建沿用本地 Vite 环境变量（例如地图配置），不写入服务器密码。产物目录 `outputs/server/` 包含：

- `wenjiang-frontend.tar.gz`：包根目录包含 index.html 和 assets。
- `deploy.sh`：在 Linux 服务器执行的发布脚本。
- `wenjiang-frontend.nginx.conf`：IP 访问的 Nginx 配置。

## 手动上传

使用 SFTP 工具连接 `156.238.249.157`，账号 `root`，将以上三个文件上传至 `/data/wenjiang/frontend/`。也可在本机项目目录使用以下命令，并按提示输入 SSH 密码：

```sh
ssh root@156.238.249.157 'mkdir -p /data/wenjiang/frontend'
scp outputs/server/wenjiang-frontend.tar.gz outputs/server/deploy.sh outputs/server/wenjiang-frontend.nginx.conf root@156.238.249.157:/data/wenjiang/frontend/
```

## 服务器发布

服务器需要已安装并运行由 systemd 管理的 Nginx，主配置需要包含 `/etc/nginx/conf.d/*.conf`。如尚未安装，Ubuntu / Debian 可执行：

```sh
apt-get update
apt-get install -y nginx
systemctl enable --now nginx
```

SSH 登录后执行：

```sh
sh /data/wenjiang/frontend/deploy.sh
```

首次发布自动安装 `/etc/nginx/conf.d/wenjiang-frontend.conf`；已有配置不会覆盖。配置监听 80 端口，`server_name` 为 `156.238.249.157`，静态目录为 `/data/wenjiang/frontend/current`。若同一 IP 已有站点配置，先调整其 `server_name`，避免重复；其他域名的站点可继续共用 80 端口。确保服务器防火墙和云安全组允许访问 TCP 80。

脚本先解压和校验，再执行 `nginx -t`，通过后切换 `current` 并平滑重载 Nginx。重载失败会恢复上一版；首次发布失败会撤销版本切换及新建配置。`current`、`previous` 必须是脚本管理的符号链接，不会覆盖已有实体目录。

访问：<http://156.238.249.157/#/tools/collection-coordinates>

```text
/data/wenjiang/frontend/
  wenjiang-frontend.tar.gz
  deploy.sh
  wenjiang-frontend.nginx.conf
  current -> releases/本次版本
  previous -> releases/上一版本
  releases/
```

后续发布：重新打包，上传压缩包和最新脚本，再执行同一条部署命令。已有 Nginx 配置需调整时，在服务器手动编辑 `/etc/nginx/conf.d/wenjiang-frontend.conf` 后执行 `nginx -t && systemctl reload nginx`。

前端保留 Hash 路由及相对资源路径；核验地图 API 仍直接访问 `https://car.r10iot.com`，与 GitHub Pages 的请求方式相同。部署文件不保存 SSH 密码、业务登录凭据或 Token。
