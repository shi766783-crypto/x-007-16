<script setup>
import { ref } from 'vue'
import { LOCATIONS, LOCATION_ICONS } from '@/constants'
import { useZonesStore } from '@/stores/zones'
import { useInventoryStore } from '@/stores/inventory'

const zones = useZonesStore()
const inventory = useInventoryStore()

// 可选分区图标
const ICON_CHOICES = ['📦', '🥬', '🥛', '🥚', '🥩', '🐟', '🧆', '🍦', '🧂', '🥤', '🍷', '🧊', '🗄️', '📥', '🧺']

// 新建分区的表单（每种存放方式独立一行）
const drafts = ref({ 冷藏: '', 冷冻: '', 常温: '' })

function addZone(type) {
  const name = drafts.value[type].trim()
  if (!name) return
  try {
    zones.addZone({ name, type, icon: '📦' })
    drafts.value[type] = ''
  } catch (e) {
    alert(e.message)
  }
}

// 编辑中的分区
const editingId = ref('')
const editingName = ref('')
const editingIcon = ref('')

function startEdit(zone) {
  editingId.value = zone.id
  editingName.value = zone.name
  editingIcon.value = zone.icon
}

function saveEdit() {
  try {
    zones.updateZone(editingId.value, { name: editingName.value, icon: editingIcon.value })
    editingId.value = ''
  } catch (e) {
    alert(e.message)
  }
}

// 删除流程：先让用户选择食材去向
const deleting = ref(null) // 正在删除的分区
const moveToId = ref('')

function startDelete(zone) {
  deleting.value = zone
  moveToId.value = zones.byType[zone.type].find((z) => z.id !== zone.id)?.id || ''
}

function confirmDelete() {
  try {
    zones.removeZone(deleting.value.id, moveToId.value)
    deleting.value = null
  } catch (e) {
    alert(e.message)
  }
}

function itemCount(zoneId) {
  return inventory.items.filter((i) => i.zoneId === zoneId).length
}
</script>

<template>
  <div class="zone-manager">
    <p class="hint muted">
      按家里冰箱的真实格局划分区域，入库时选到具体的一格，找食材不用再翻箱倒柜。
    </p>

    <div v-for="type in LOCATIONS" :key="type" class="type-block">
      <div class="type-title">{{ LOCATION_ICONS[type] }} {{ type }}</div>

      <div class="zone-list">
        <div v-for="zone in zones.byType[type]" :key="zone.id" class="zone-row">
          <template v-if="editingId === zone.id">
            <select v-model="editingIcon" class="icon-edit">
              <option v-for="ic in ICON_CHOICES" :key="ic" :value="ic">{{ ic }}</option>
            </select>
            <input v-model="editingName" class="name-edit" type="text" />
            <button class="row-btn ok" @click="saveEdit">保存</button>
            <button class="row-btn" @click="editingId = ''">取消</button>
          </template>
          <template v-else>
            <span class="zone-icon">{{ zone.icon }}</span>
            <span class="zone-name">{{ zone.name }}</span>
            <span class="zone-count muted">{{ itemCount(zone.id) }} 样食材</span>
            <button class="row-btn" @click="startEdit(zone)">编辑</button>
            <button class="row-btn danger" @click="startDelete(zone)">删除</button>
          </template>
        </div>
        <div v-if="!zones.byType[type].length" class="empty-type muted">该存放方式下还没有分区</div>
      </div>

      <div class="add-row">
        <input
          v-model="drafts[type]"
          type="text"
          :placeholder="`给「${type}」加一个分区，如门架搁板`"
          @keyup.enter="addZone(type)"
        />
        <button class="add-btn" @click="addZone(type)">+ 添加</button>
      </div>
    </div>

    <!-- 删除确认：选择食材去向 -->
    <div v-if="deleting" class="delete-mask" @click.self="deleting = null">
      <div class="delete-dialog card">
        <h4>删除分区「{{ deleting.icon }} {{ deleting.name }}」</h4>
        <p class="muted">
          该分区下有 <b>{{ itemCount(deleting.id) }}</b> 样食材，删除后需要统一移动到：
        </p>
        <select v-model="moveToId">
          <option
            v-for="z in zones.byType[deleting.type].filter((z) => z.id !== deleting.id)"
            :key="z.id"
            :value="z.id"
          >
            {{ z.icon }} {{ z.name }}
          </option>
        </select>
        <p v-if="zones.byType[deleting.type].length <= 1" class="warn-tip">
          每种存放方式至少保留一个分区，无法删除。
        </p>
        <div class="dialog-actions">
          <button class="row-btn" @click="deleting = null">取消</button>
          <button
            class="row-btn danger"
            :disabled="!moveToId"
            @click="confirmDelete"
          >
            确认删除并迁移
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint {
  font-size: 13px;
  margin: 0 0 16px;
}
.type-block {
  margin-bottom: 18px;
}
.type-block:last-child {
  margin-bottom: 0;
}
.type-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.zone-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.zone-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-2);
  border-radius: 8px;
}
.zone-icon {
  font-size: 18px;
}
.zone-name {
  font-weight: 500;
}
.zone-count {
  font-size: 12px;
  flex: 1;
}
.icon-edit {
  width: 64px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
}
.name-edit {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.row-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.row-btn.ok {
  border-color: var(--primary);
  color: var(--primary-dark);
}
.row-btn.danger {
  border-color: var(--danger);
  color: var(--danger);
}
.empty-type {
  font-size: 12px;
  padding: 6px 10px;
}
.add-row {
  display: flex;
  gap: 8px;
}
.add-row input {
  flex: 1;
  padding: 7px 12px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  background: #fff;
}
.add-btn {
  border: 1px solid var(--primary);
  background: var(--primary-light);
  color: var(--primary-dark);
  border-radius: 8px;
  padding: 0 16px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.delete-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
}
.delete-dialog {
  width: 420px;
  max-width: 100%;
}
.delete-dialog h4 {
  margin-bottom: 8px;
}
.delete-dialog p {
  font-size: 13px;
}
.delete-dialog select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 8px 0;
  background: #fff;
}
.warn-tip {
  color: var(--danger);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
