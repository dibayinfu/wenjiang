import { createApp } from "vue";
import { createPinia } from "pinia";
import {
  Alert,
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Link,
  Menu,
  Modal,
  Pagination,
  Progress,
  Radio,
  Scrollbar,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "@arco-design/web-vue";
import "./styles/arco-ui/index.less";
import "./styles/index.scss";
import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);
for (const component of [
  Alert,
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Link,
  Menu,
  Modal,
  Pagination,
  Progress,
  Radio,
  Scrollbar,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
])
  app.use(component);
Modal._context = app._context;
Drawer._context = app._context;
app.use(createPinia()).use(router).mount("#app");
