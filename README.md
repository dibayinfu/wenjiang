# 温江餐厨收运管理平台

参考龙安项目的 Vue 3 / Arco Design 蓝白后台风格、指标卡片、表格筛选和详情抽屉，搭建可独立运行的产品原型。当前功能仅为示例，后续按温江实际需求迭代。

- 在线原型：https://dibayinfu.github.io/wenjiang/
- GitHub 仓库：git@github.com:dibayinfu/wenjiang.git
- 技术栈：Vue 3、TypeScript、Vite、Vue Router、Arco Design。
- **只有前端，所有商户、人员、车辆、地址和收运数据均为虚构模拟数据。** 无登录、后端、数据库、地图密钥或外部业务接口。

## 本地运行

需要 Node.js 22.14+（推荐 Node.js 22 LTS）或 24+，以及 npm。

```sh
cd /Users/aaronxu/Projects/xeazon/wenjiang
npm ci
npm run dev
```

打开 http://127.0.0.1:5174 。停止预览按 `Ctrl+C`。

```sh
npm test          # 模拟数据、状态流转、派单约束、缓存校验、CSV 安全
npm run build    # TypeScript 检查 + 静态产物构建
npm run preview  # http://127.0.0.1:4174，预览 dist 产物
```

## 三个示例页

| 页面     | 地址          | 可体验内容                                                      |
| -------- | ------------- | --------------------------------------------------------------- |
| 运营总览 | `#/overview`  | 今日指标、收运趋势、任务进度、区域示意图和任务跳转              |
| 收运作业 | `#/tasks`     | 关键词/街道/状态筛选、分页、详情、派单、开始/完成收运、CSV 导出 |
| 餐厨商户 | `#/merchants` | 商户档案、筛选、详情、今日收运记录、新增商户、CSV 导出          |

可体验业务闭环：新增商户 → 派发任务 → 开始收运 → 完成收运 → 总览统计与商户记录同步更新。

## 模拟数据

`src/mock/model.ts` 集中提供类型化的种子数据和纯业务函数，`src/mock/store.ts` 负责 Vue 响应式状态与浏览器存储。借鉴龙安集中管理模拟数据、原型直接进入业务页面的方式，不引入网络请求拦截或后端依赖。

- 初始 28 家商户、24 家签约商户、4 辆车、24 条今日任务。
- 今日收运量仅汇总已完成任务实际重量；完成模拟任务时使用预计重量。
- 允许为已完成过收运的商户再次派单；存在未完成任务或暂停收运的商户不可派单。
- 数据保存在当前浏览器 `localStorage` 的 `wenjiang:prototype:v1` 中。当天刷新保留操作，按北京时间跨日重新初始化；可在左下角“关于项目原型”中重置。
- 最近 6 天趋势为固定演示值，今日为动态统计。区域地图为业务示意图，不是真实 GIS 地图。
- 浏览器禁用存储时降级为内存状态，并在页面提示。
- CSV 导出为当前筛选的全部结果，包含中文 BOM 和公式注入处理。

## 目录与隔离

```text
wenjiang/
├── .github/workflows/pages.yml   # dev/PR 验证，main 自动发布
├── public/                      # 项目自身静态资源
├── src/
│   ├── components/              # 标题、指标、状态和图标
│   ├── mock/                    # 数据模型、生成器、独立状态
│   ├── utils/csv.ts             # 安全 CSV 导出
│   ├── views/                   # 三个业务示例页
│   ├── App.vue                  # 后台布局
│   ├── router.ts                # Hash 路由
│   └── styles.css               # 独立样式与响应式适配
├── tests/model.test.mjs
├── package.json
└── package-lock.json
```

**本目录是独立 Git 仓库，不使用父目录依赖、workspace、软链接、绝对路径导入或龙安文件。** 保留或移动整个 `wenjiang` 文件夹即可运行。删除其父目录会连带删除它，请先移出 `wenjiang`，或仅删除父目录内其他项目。移动后在新目录执行 `npm ci` 即可。

## 分支与自动部署

- `main`：在线演示版本。
- `dev`：日常开发，推送后执行测试和构建，不发布。
- PR 合并到 `main` 后执行测试、构建并发布至 GitHub Pages；首次初始化直接推送 `main` 也会发布。
- GitHub → Settings → Pages → Source 选择 **GitHub Actions**。
- 使用相对静态资源路径及 Hash 路由，支持 `/wenjiang/` 子目录和刷新详情页。

```sh
git switch dev
# 修改后
git add .
git commit -m "feat: 完善温江业务原型"
git push origin dev
```

在 GitHub 创建 `dev → main` 的 Pull Request，验证通过后合并即可自动发布。Actions 工作流执行失败时不会更新在线版本。

部署配置参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy.html#github-pages)。
