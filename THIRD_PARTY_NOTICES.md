# 前端框架来源

温江项目的混合布局、基础样式及 Arco 组件覆盖迁自龙安项目的
`continew-admin-ui`（基于 ContiNew Admin，Copyright (c) 2022-present Charles7c Authors）。
原框架使用 Apache License 2.0，许可证保留在 `LICENSES/continew-admin.txt`。

迁入后修改了 `LayoutMix`、Logo、菜单、页签和顶部工具栏的业务路由与状态依赖，
移除了认证、权限、公告及其他后端接口，改为温江独立的前端状态；
基础样式仅调整 Sass 模块入口，Arco 样式入口改为完整 Less 编译。

Arco Design 和 `@arco-themes/vue-gi-demo` 通过 npm 独立安装，并遵循各自许可证。
