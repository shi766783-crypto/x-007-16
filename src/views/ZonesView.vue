<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useZoneStore } from '@/stores/zones'
import { LOCATIONS, LOCATION_ICONS } from '@/constants'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'

const router = useRouter()
const zoneStore = useZoneStore()

const ZONE_ICONS = ['🥬', '🥩', '🐟', '🥚', '🥛', '🍎', '🧊', '🍚', '🧂', '🍄', '🗄️', '📦', '🧺', '🧃']

const showForm = ref(false)
const editing = ref(null)
const form = reactive({ name: '', location: '冷藏', icon: '📦', note: '' })

// 未分配区域的食材统计
const unassigned = computed(() => zoneStore.stats[''] || { total: 0, near: 0, expired: 0 })

function statOf(zoneId) {
  return zoneStore.stats[zoneId] || { total: 0, near: 0, expired: 0 }
}

function openAdd(location = '冷藏') {
  editing.value = null
  Object.assign(form, { name: '', location, icon: '📦', note: '' })
  showForm.value = true
}

function openEdit(zone) {
  editing.value = zone
  Object.assign(form, { name: zone.name, location: zone.location, icon: zone.icon, note: zone.note })
  showForm.value = true
}

function onSave() {
  if (!form.name.trim()) return
  const data = { ...form, name: form.name.trim() }
  if (editing.value) zoneStore.updateZone(editing.value.id, data)
  else zoneStore.addZone(data)
  showForm.value = false
}

function onRemove(zone) {
  const count = statOf(zone.id).total
  const tip = count
    ? `分区「${zone.name}」内还有 ${count} 种食材，删除后它们将变为「未分配」。确定删除？`
    : `确定删除分区「${zone.name}」？`
  if (window.confirm(tip)) zoneStore.removeZone(zone.id)
}

// 跳转到库存页并按该区域筛选
function viewItems(zoneId) {
  router.push({ path: '/inventory', query: { zone: zoneId || 'none' } })
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2>🧊 冰箱分区</h2>
      <BaseButton @click="openAdd()">+ 新增分区</BaseButton>
    </div>

    <div v-if="unassigned.total" class="unassigned card" @click="viewItems('')">
      <span class="ua-icon">❓</span>
      <div class="ua-info">
        <div class="ua-name">未分配区域</div>
        <div class="muted small">共 {{ unassigned.total }} 种食材还没归类，点击去盘点</div>
      </div>
      <span v-if="unassigned.expired" class="badge danger">过期 {{ unassigned.expired }}</span>
      <span v-if="unassigned.near" class="badge warn">临期 {{ unassigned.near }}</span>
    </div>

    <div v-for="loc in LOCATIONS" :key="loc" class="loc-section">
      <div class="loc-head">
        <span class="loc-title">{{ LOCATION_ICONS[loc] }} {{ loc }}</span>
        <BaseButton size="sm" variant="text" @click="openAdd(loc)">+ 添加</BaseButton>
      </div>

      <BaseEmpty
        v-if="!zoneStore.byLocation[loc]?.length"
        emoji="🗂️"
        :text="`「${loc}」还没有分区，点击右上角添加一个吧`"
      />

      <div v-else class="grid grid-3">
        <div v-for="zone in zoneStore.byLocation[loc]" :key="zone.id" class="zone card">
          <div class="zone-head">
            <span class="z-icon">{{ zone.icon }}</span>
            <div class="z-info">
              <div class="z-name">{{ zone.name }}</div>
              <div class="muted small">共 {{ statOf(zone.id).total }} 种食材</div>
            </div>
            <div class="z-badges">
              <span v-if="statOf(zone.id).expired" class="badge danger">过期 {{ statOf(zone.id).expired }}</span>
              <span v-if="statOf(zone.id).near" class="badge warn">临期 {{ statOf(zone.id).near }}</span>
            </div>
          </div>
          <div v-if="zone.note" class="z-note">{{ zone.note }}</div>
          <div class="z-actions">
            <BaseButton size="sm" variant="ghost" @click="viewItems(zone.id)">查看食材</BaseButton>
            <BaseButton size="sm" variant="ghost" @click="openEdit(zone)">编辑</BaseButton>
            <BaseButton size="sm" variant="text" @click="onRemove(zone)">删除</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <BaseModal :show="showForm" :title="editing ? '编辑分区' : '新增分区'" @close="showForm = false">
      <form class="zone-form" @submit.prevent="onSave">
        <div class="field">
          <label>分区名称 *</label>
          <input v-model="form.name" type="text" placeholder="如：冷藏·上层、蔬果盒" required />
        </div>
        <div class="field">
          <label>所属位置</label>
          <select v-model="form.location">
            <option v-for="l in LOCATIONS" :key="l" :value="l">{{ LOCATION_ICONS[l] }} {{ l }}</option>
          </select>
        </div>
        <div class="field">
          <label>图标</label>
          <div class="icon-picker">
            <button
              v-for="ic in ZONE_ICONS"
              :key="ic"
              type="button"
              class="icon-chip"
              :class="{ on: form.icon === ic }"
              @click="form.icon = ic"
            >
              {{ ic }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>备注</label>
          <textarea v-model="form.note" rows="2" placeholder="如：剩菜放这里，优先消耗"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="showForm = false">取消</button>
          <button type="submit" class="btn-submit">保存</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-head h2 {
  margin: 0;
}
.unassigned {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  cursor: pointer;
  border: 1px dashed var(--border);
}
.ua-icon {
  font-size: 24px;
}
.ua-info {
  flex: 1;
}
.ua-name {
  font-weight: 600;
}
.small {
  font-size: 12px;
}
.loc-section {
  margin-bottom: 20px;
}
.loc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.loc-title {
  font-weight: 600;
  font-size: 15px;
}
.zone {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.zone-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.z-icon {
  font-size: 26px;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.z-info {
  flex: 1;
  min-width: 0;
}
.z-name {
  font-weight: 600;
  font-size: 15px;
}
.z-badges {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #fff;
  white-space: nowrap;
}
.badge.danger {
  background: var(--danger);
}
.badge.warn {
  background: var(--warn);
}
.z-note {
  font-size: 12px;
  color: var(--text-2);
  background: var(--surface-2);
  padding: 6px 10px;
  border-radius: 8px;
}
.z-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.zone-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
}
input,
select,
textarea {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  background: #fff;
}
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--primary);
}
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.icon-chip {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
  font-size: 18px;
  cursor: pointer;
}
.icon-chip.on {
  border-color: var(--primary);
  background: var(--primary-light);
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.btn-cancel,
.btn-submit {
  padding: 9px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.btn-cancel {
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text);
}
.btn-submit {
  background: var(--primary);
  border: none;
  color: #fff;
  font-weight: 600;
}
</style>
