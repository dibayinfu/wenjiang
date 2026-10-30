import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // 相对资源路径 + hash 路由：兼容 /wenjiang/、本地预览和独立目录部署。
  base: "./",
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          framework: ["vue", "vue-router", "pinia"],
          arco: ["@arco-design/web-vue"],
        },
      },
    },
  },
});
