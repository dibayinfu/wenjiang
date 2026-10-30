<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import { demo, merchantName } from "../mock/store";
import { finishTask } from "../mock/model";
const props = defineProps<{ taskId: string }>();
const emit = defineEmits<{ close: [] }>();
const task = computed(() => demo.tasks.find((t) => t.id === props.taskId));
const kg = ref(0);
const buckets = ref(1);
watch(
  () => props.taskId,
  () => (kg.value = task.value?.plannedKg ?? 0),
  { immediate: true },
);
function save() {
  try {
    finishTask(demo, props.taskId, kg.value, new Date(), buckets.value);
    emit("close");
    Message.success("模拟称重已保存，收运统计同步更新");
  } catch (e) {
    Message.warning((e as Error).message);
  }
}
</script>
<template>
  <a-modal
    :visible="!!taskId"
    title="完成收运 · 模拟称重"
    :footer="false"
    :width="'min(480px,94vw)'"
    @cancel="emit('close')"
    ><template v-if="task"
      ><p class="modal-description">
        {{ merchantName(task.merchantId) }} · {{ task.vehicle }}
      </p>
      <a-form layout="vertical" @submit="save"
        ><a-form-item label="实际净重（kg）" required
          ><a-input-number
            v-model="kg"
            :min="0"
            :max="10000"
            :precision="1"
            aria-label="实际净重"
            style="width: 100%" /></a-form-item
        ><a-form-item label="实际收运桶数" required
          ><a-input-number
            v-model="buckets"
            :min="1"
            :max="100"
            :precision="0"
            aria-label="实际收运桶数" /></a-form-item
        ><a-alert
          >重量和桶数均明确录入；保存后同步报表。正式系统由逐桶称重事件汇总，不以重量推算桶数。</a-alert
        >
        <div class="modal-actions">
          <a-button @click="emit('close')">取消</a-button
          ><a-button type="primary" html-type="submit">保存称重并完成</a-button>
        </div></a-form
      ></template
    ><a-empty v-else description="记录不存在，请重新选择"
  /></a-modal>
</template>
