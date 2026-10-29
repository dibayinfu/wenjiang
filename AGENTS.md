# 温江餐厨前端原型

- 这是独立的 Vue 3 + TypeScript + Vite + Arco Design 纯前端项目。
- 暂无正式业务需求，当前三个页面是可交互示例；避免引入未经确认的复杂业务。
- 所有业务数据集中在 `src/mock/`，统计必须从同一份数据派生；页面不得引入后端、真实身份、密钥或其他项目的数据。
- 不依赖父目录、龙安项目、软链接或共享 node_modules；保持整个文件夹可独立移动。
- 必须沿用龙安实际的 ContiNew Admin / Arco Design 框架：默认侧栏布局 / LayoutMix、vue-gi-demo 主题和 src/styles/arco-ui 覆盖；禁止另外设计一套后台壳。
- 优先复用迁入的标题、指标卡、分组菜单、多页签和 Arco 原生组件；业务页面只添加必要的布局样式。
- 后续日常开发使用 `dev`；合并到 `main` 后由 GitHub Actions 自动部署 Pages。
- 保留 Hash 路由与相对静态资源路径，保证 GitHub Pages 子路径及刷新可用。
- 以中文简洁汇报：结论 → 修改点 → 代码或命令。

## 验证命令

```sh
npm test
npm run build
npm run preview
```

本机只有 16 GB 内存。构建与测试串行执行，优先针对性验证，仅在需要时启动一个临时预览服务，验收后关闭。不要遗留 watch 或后台服务。
