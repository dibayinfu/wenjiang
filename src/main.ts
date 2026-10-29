import { createApp } from "vue";
import {
  Alert,
  Button,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Progress,
  Select,
  Table,
  Tag,
} from "@arco-design/web-vue";
import "@arco-design/web-vue/dist/arco.css";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

const app = createApp(App);
for (const component of [
  Alert,
  Button,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Progress,
  Select,
  Table,
  Tag,
]) {
  app.use(component);
}
app.use(router).mount("#app");
