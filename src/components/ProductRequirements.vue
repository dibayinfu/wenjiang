<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { requirements } from "../mock/requirements";
const route = useRoute();
const spec = computed(() => requirements[route.path]);
</script>
<template>
  <details v-if="spec" class="product-requirements">
    <summary>
      产品需求说明 <span>功能 / 规则 / 交互</span>
    </summary>
    <div class="requirements-body">
      <p><strong>使用场景：</strong>{{ spec.goal }}</p>
      <div class="requirements-grid">
        <div>
          <h3>字段口径与规则</h3>
          <ul>
            <li v-for="rule in spec.rules" :key="rule" :class="{ 'requirement-new': rule.startsWith('【新增') }">{{ rule.replace(/^【新增[^】]*】/, '') }}</li>
          </ul>
        </div>
        <div>
          <h3>交互与联动</h3>
          <ul>
            <li v-for="item in spec.interactions" :key="item" :class="{ 'requirement-new': item.startsWith('【新增') }">{{ item.replace(/^【新增[^】]*】/, '') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
.requirement-new { color: rgb(var(--danger-6)); font-weight: 600; }
</style>
