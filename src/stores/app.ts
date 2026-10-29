// 基于龙安 app store 的主题初始化与菜单状态，移除后端系统配置依赖。
import { generate, getRgbStr } from "@arco-design/color";
import { defineStore } from "pinia";
import { reactive, toRefs } from "vue";
import { defaultSettings } from "../config/setting";

export const useAppStore = defineStore("app", () => {
  const settings = reactive({ ...defaultSettings });
  function initTheme() {
    if (settings.theme === "dark")
      document.body.setAttribute("arco-theme", "dark");
    else document.body.removeAttribute("arco-theme");
    const colors = generate(settings.themeColor, {
      list: true,
      dark: settings.theme === "dark",
    }) as string[];
    colors.forEach((color, index) =>
      document.body.style.setProperty(
        `--primary-${index + 1}`,
        getRgbStr(color),
      ),
    );
  }
  function toggleTheme() {
    settings.theme = settings.theme === "light" ? "dark" : "light";
    initTheme();
  }
  return { ...toRefs(settings), initTheme, toggleTheme };
});
