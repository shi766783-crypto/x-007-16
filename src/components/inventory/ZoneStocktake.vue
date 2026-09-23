<script setup>
import { ref, computed } from 'vue'
import { useZonesStore } from '@/stores/zones'
import { useInventoryStore } from '@/stores/inventory'
import { CATEGORY_ICONS } from '@/constants'
import { formatDate } from '@/utils/date'

const props = defineProps({
  zone: { type: Object, required: true },
})
const emit = defineEmits(['close', 'edit-item'])

const zones = useZonesStore()
const inventory = useInventoryStore()

// 该分区下的全部食材（附带临期状态）
const items = computed(() =>
  inventory.withExpiry
    .filter((i) => i.zoneId === props.zone.id)
    .sort((a, b) => a.remain - b.remain),
)

const checkedIds = ref({})
const checkedCount = computed(() => Object.values(checkedIds.value).filter(Boolean).length)
const allDone = computed(() => items.value.length > 0 && checkedCount.value === items.value.length)

function statusTag(item) {
  if (item.status === 'expired') return { text: `过期 ${Math.abs(item.remain)} 天`, color: '#ef5350' }
  if (item.status === 'near') return { text: `剩余 ${item.remain} 天`, color: '#ff9800' }
  return { text: `剩余 ${item.remain} 天`, color: '#4caf50' }
}

function finish() {
  zones.markChecked(props.zone.id)
  emit('close')
}
</script>

<template>
  <div class="stocktake">
    <div class="st-head">
      <div>
        <span class="st-icon">{{ zone.icon }}</span>
        <b>{{ zone.name }}</b>
        <span class="muted small">（{{ zone.type }}）</span>
      </div>
      <div class="muted small" v-if="zone.lastCheckedAt">
        上次盘点：{{ formatDate(zone.lastCheckedAt) }}
      </div>
    </div>

    <div class="progress">
      <div class="bar" :style="{ width: items.length ? (checkedCount / items.length) * 100 + '%' : '0%' }"></div>
    </div>
    <div class="muted small progress-txt">
      已核对 {{ checkedCount }} / {{ items.length }} 样
      <span v-if="allDone" class="ok">— 全部核对完毕 ✅</span>
    </div>

    <div v-if="!items.length" class="st-empty muted">这个分区现在没有食材。</div>

    <div v-else class="st-list">
      <label
        v-for="item in items"
        :key="item.id"
        class="st-item"
        :class="{ checked: checkedIds[item.id], [item.status]: true }"
      >
        <input v-model="checkedIds[item.id]" type="checkbox" />
        <span class="cat">{{ CATEGORY_ICONS[item.category] }}</span>
        <span class="nm">{{ item.name }}</span>
        <span class="qty muted">{{ item.quantity }}{{ item.unit }}</span>
        <span class="tag" :style="{ color: statusTag(item).color }">{{ statusTag(item).text }}</span>
        <button class="edit" @click.prevent="emit('edit-item', item)">编辑</button>
      </label>
    </div>

    <div class="st-actions">
      <button class="btn ghost" @click="emit('close')">关闭</button>
      <button class="btn primary" :disabled="!items.length" @click="finish">
        {{ allDone ? '完成盘点' : '结束并记录盘点' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.st-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.st-icon {
  font-size: 20px;
  margin-right: 4px;
}
.small {
  font-size: 12px;
}
.progress {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.2s;
}
.progress-txt {
  margin: 6px 0 12px;
}
.ok {
  color: var(--primary-dark);
  font-weight: 600;
}
.st-empty {
  font-size: 13px;
  padding: 16px 0;
  text-align: center;
}
.st-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 46vh;
  overflow-y: auto;
}
.st-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-2);
  cursor: pointer;
}
.st-item.near {
  background: var(--warn-light);
}
.st-item.expired {
  background: var(--danger-light);
}
.st-item.checked {
  opacity: 0.55;
}
.st-item.checked .nm {
  text-decoration: line-through;
}
.cat {
  font-size: 18px;
}
.nm {
  font-weight: 500;
}
.qty {
  font-size: 12px;
}
.tag {
  font-size: 12px;
  font-weight: 600;
}
.edit {
  margin-left: auto;
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
}
.st-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.btn {
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 14px;
  cursor: pointer;
}
.btn.ghost {
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text);
}
.btn.primary {
  background: var(--primary);
  border: none;
  color: #fff;
  font-weight: 600;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
