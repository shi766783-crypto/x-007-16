<script setup>
import { ref, computed } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { useZonesStore } from '@/stores/zones'
import { CATEGORIES, LOCATIONS, CATEGORY_ICONS, LOCATION_ICONS } from '@/constants'
import IngredientForm from '@/components/inventory/IngredientForm.vue'
import ZoneManager from '@/components/inventory/ZoneManager.vue'
import ZoneStocktake from '@/components/inventory/ZoneStocktake.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseTag from '@/components/common/BaseTag.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { formatDate } from '@/utils/date'

const inventory = useInventoryStore()
const zones = useZonesStore()

const viewMode = ref('zone') // zone | list

const showForm = ref(false)
const editing = ref(null)
const showZoneManager = ref(false)
const stocktakingZone = ref(null)

const filterCategory = ref('全部')
const filterStatus = ref('全部')
const filterLocation = ref('全部')

const statusFilter = ['全部', 'fresh', 'near', 'expired']

const allItems = computed(() =>
  inventory.withExpiry.filter((i) => {
    if (filterCategory.value !== '全部' && i.category !== filterCategory.value) return false
    if (filterStatus.value !== '全部' && i.status !== filterStatus.value) return false
    return true
  }),
)

// 列表视图：额外按存放方式筛选
const filtered = computed(() =>
  allItems.value.filter((i) => {
    if (filterLocation.value !== '全部' && i.location !== filterLocation.value) return false
    return true
  }),
)

// 分区视图：按分区归类的统计与列表
const zoneGroups = computed(() => {
  const groups = zones.ordered.map((zone) => {
    const items = allItems.value
      .filter((i) => i.zoneId === zone.id)
      .sort((a, b) => {
        // 过期 → 临期 → 新鲜
        const rank = { expired: 0, near: 1, fresh: 2 }
        return rank[a.status] - rank[b.status] || a.remain - b.remain
      })
    const expired = items.filter((i) => i.status === 'expired').length
    const near = items.filter((i) => i.status === 'near').length
    return { zone, items, total: items.length, expired, near }
  })

  // 数据异常（分区被删等）时兜底，提示用户重新指定
  const orphan = allItems.value.filter((i) => !zones.zoneMap[i.zoneId])
  if (orphan.length) {
    groups.push({
      zone: { id: '__orphan__', name: '未指定区域', type: '', icon: '❓', lastCheckedAt: '' },
      items: orphan,
      total: orphan.length,
      expired: orphan.filter((i) => i.status === 'expired').length,
      near: orphan.filter((i) => i.status === 'near').length,
      orphan: true,
    })
  }
  return groups
})

// 顶部「需要关注的角落」：有临期/过期食材的分区，按紧急度排序
const alertZones = computed(() =>
  zoneGroups.value
    .filter((g) => g.expired || g.near)
    .sort((a, b) => b.expired - a.expired || b.near - a.near),
)

function focusZone(zoneId) {
  document.getElementById(`zone-card-${zoneId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function openAdd() {
  editing.value = null
  showForm.value = true
}

function openEdit(item) {
  editing.value = item
  showForm.value = true
  stocktakingZone.value = null
}

function onSave(data) {
  if (editing.value) inventory.updateItem(editing.value.id, data)
  else inventory.addItem(data)
  showForm.value = false
}

function statusTag(item) {
  if (item.status === 'expired') return { text: `过期 ${Math.abs(item.remain)} 天`, color: '#ef5350' }
  if (item.status === 'near') return { text: `剩余 ${item.remain} 天`, color: '#ff9800' }
  return { text: `剩余 ${item.remain} 天`, color: '#4caf50' }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2>🥬 食材库存</h2>
      <div class="head-actions">
        <BaseButton variant="ghost" @click="showZoneManager = true">🗂️ 分区管理</BaseButton>
        <BaseButton @click="openAdd">+ 添加食材</BaseButton>
      </div>
    </div>

    <div class="filters card">
      <div class="filter-group">
        <span class="f-label">视图</span>
        <button class="chip" :class="{ on: viewMode === 'zone' }" @click="viewMode = 'zone'">分区视图</button>
        <button class="chip" :class="{ on: viewMode === 'list' }" @click="viewMode = 'list'">列表视图</button>
      </div>
      <div class="filter-group">
        <span class="f-label">类别</span>
        <button
          v-for="c in ['全部', ...CATEGORIES]"
          :key="c"
          class="chip"
          :class="{ on: filterCategory === c }"
          @click="filterCategory = c"
        >
          {{ c === '全部' ? '全部' : CATEGORY_ICONS[c] + ' ' + c }}
        </button>
      </div>
      <div class="filter-group">
        <span class="f-label">状态</span>
        <button
          v-for="s in statusFilter"
          :key="s"
          class="chip"
          :class="{ on: filterStatus === s }"
          @click="filterStatus = s"
        >
          {{ { 全部: '全部', fresh: '新鲜', near: '临期', expired: '过期' }[s] }}
        </button>
      </div>
      <div v-if="viewMode === 'list'" class="filter-group">
        <span class="f-label">位置</span>
        <button
          v-for="l in ['全部', ...LOCATIONS]"
          :key="l"
          class="chip"
          :class="{ on: filterLocation === l }"
          @click="filterLocation = l"
        >
          {{ l === '全部' ? '全部' : LOCATION_ICONS[l] + ' ' + l }}
        </button>
      </div>
    </div>

    <!-- 分区视图：临期食材堆在哪个角落，一眼可见 -->
    <template v-if="viewMode === 'zone'">
      <div v-if="alertZones.length" class="alert-strip card">
        <span class="alert-title">⚠️ 需要关注的角落</span>
        <button
          v-for="g in alertZones"
          :key="g.zone.id"
          class="alert-pill"
          @click="focusZone(g.zone.id)"
        >
          {{ g.zone.icon }} {{ g.zone.name }}
          <b v-if="g.expired" class="cnt-exp">{{ g.expired }} 过期</b>
          <b v-if="g.near" class="cnt-near">{{ g.near }} 临期</b>
        </button>
      </div>

      <BaseEmpty v-if="!allItems.length && !zoneGroups.length" emoji="🧺" text="库存空空如也，点击右上角添加食材吧" />

      <div class="zone-grid">
        <section
          v-for="g in zoneGroups"
          :id="`zone-card-${g.zone.id}`"
          :key="g.zone.id"
          class="zone-card card"
          :class="{ 'has-alert': g.expired || g.near, orphan: g.orphan }"
        >
          <header class="zc-head">
            <span class="zc-icon">{{ g.zone.icon }}</span>
            <div class="zc-info">
              <div class="zc-name">
                {{ g.zone.name }}
                <span v-if="g.zone.type" class="zc-type">{{ LOCATION_ICONS[g.zone.type] }} {{ g.zone.type }}</span>
              </div>
              <div class="zc-sub muted">
                {{ g.total }} 样食材
                <template v-if="g.zone.lastCheckedAt"> · 上次盘点 {{ formatDate(g.zone.lastCheckedAt) }}</template>
              </div>
            </div>
            <div class="zc-badges">
              <span v-if="g.expired" class="badge danger">{{ g.expired }} 过期</span>
              <span v-if="g.near" class="badge warn">{{ g.near }} 临期</span>
            </div>
            <BaseButton v-if="!g.orphan" size="sm" variant="ghost" @click="stocktakingZone = g.zone">
              📋 盘点
            </BaseButton>
          </header>

          <BaseEmpty
            v-if="!g.items.length"
            emoji="🗄️"
            :text="filterStatus !== '全部' || filterCategory !== '全部' ? '当前筛选下没有食材' : '这个区域还空着'"
          />

          <ul v-else class="zc-items">
            <li v-for="item in g.items" :key="item.id" class="zc-item" :class="item.status">
              <span class="zi-emoji">{{ item.photo ? '🖼️' : CATEGORY_ICONS[item.category] }}</span>
              <span class="zi-name" @click="openEdit(item)">{{ item.name }}</span>
              <span class="zi-qty muted">{{ item.quantity }}{{ item.unit }}</span>
              <BaseTag :text="statusTag(item).text" :color="statusTag(item).color" />
              <span class="zi-actions">
                <button @click="inventory.consume(item.id)">消耗</button>
                <button @click="openEdit(item)">编辑</button>
                <button class="del" @click="inventory.removeItem(item.id)">删除</button>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- 列表视图（原有展示，补充分区名） -->
    <template v-else>
      <BaseEmpty v-if="!filtered.length" emoji="🧺" text="库存空空如也，点击右上角添加食材吧" />

      <div v-else class="grid grid-3">
        <div v-for="item in filtered" :key="item.id" class="item card">
          <div class="item-head">
            <div class="thumb" v-if="item.photo"><img :src="item.photo" alt="" /></div>
            <div v-else class="thumb icon">{{ CATEGORY_ICONS[item.category] }}</div>
            <div class="head-info">
              <div class="name">{{ item.name }}</div>
              <div class="meta muted">
                {{ item.quantity }}{{ item.unit }} ·
                {{ zones.zoneMap[item.zoneId]?.icon || LOCATION_ICONS[item.location] }}
                {{ zones.nameOf(item.zoneId, item.location) }}
              </div>
            </div>
            <BaseTag :category="item.category" :text="item.category" />
          </div>
          <div class="item-body">
            <BaseTag :text="statusTag(item).text" :color="statusTag(item).color" />
            <span class="muted small">购买于 {{ formatDate(item.purchaseDate) }}</span>
          </div>
          <div v-if="item.note" class="note">{{ item.note }}</div>
          <div class="item-actions">
            <BaseButton size="sm" variant="ghost" @click="inventory.consume(item.id)">- 消耗</BaseButton>
            <BaseButton size="sm" variant="ghost" @click="openEdit(item)">编辑</BaseButton>
            <BaseButton size="sm" variant="text" @click="inventory.removeItem(item.id)">删除</BaseButton>
          </div>
        </div>
      </div>
    </template>

    <!-- 添加 / 编辑食材 -->
    <BaseModal :show="showForm" :title="editing ? '编辑食材' : '添加食材'" @close="showForm = false">
      <IngredientForm :initial="editing" @submit="onSave" @cancel="showForm = false" />
    </BaseModal>

    <!-- 分区管理 -->
    <BaseModal :show="showZoneManager" title="冰箱分区管理" width="560px" @close="showZoneManager = false">
      <ZoneManager />
    </BaseModal>

    <!-- 分区盘点 -->
    <BaseModal
      :show="!!stocktakingZone"
      title="分区盘点"
      width="560px"
      @close="stocktakingZone = null"
    >
      <ZoneStocktake
        v-if="stocktakingZone"
        :zone="stocktakingZone"
        @close="stocktakingZone = null"
        @edit-item="openEdit"
      />
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
.head-actions {
  display: flex;
  gap: 8px;
}
.filters {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.f-label {
  font-size: 12px;
  color: var(--text-2);
  width: 36px;
}
.chip {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.chip.on {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary-dark);
  font-weight: 600;
}

/* 预警条 */
.alert-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  border-color: #ffcc80;
  background: #fffdf7;
}
.alert-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--warn);
  margin-right: 4px;
}
.alert-pill {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.alert-pill:hover {
  border-color: var(--warn);
  background: var(--warn-light);
}
.cnt-exp {
  color: var(--danger);
}
.cnt-near {
  color: var(--warn);
}

/* 分区卡片 */
.zone-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-items: start;
}
@media (max-width: 900px) {
  .zone-grid {
    grid-template-columns: 1fr;
  }
}
.zone-card {
  padding: 14px;
}
.zone-card.has-alert {
  border-color: #ffb74d;
  box-shadow: 0 2px 10px rgba(255, 152, 0, 0.12);
}
.zone-card.orphan {
  border-style: dashed;
  border-color: var(--danger);
}
.zc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.zc-icon {
  font-size: 24px;
}
.zc-info {
  flex: 1;
  min-width: 0;
}
.zc-name {
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.zc-type {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 10px;
  padding: 1px 8px;
}
.zc-sub {
  font-size: 12px;
}
.zc-badges {
  display: flex;
  gap: 4px;
}
.badge {
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 8px;
  font-weight: 600;
}
.badge.danger {
  background: var(--danger-light);
  color: var(--danger);
}
.badge.warn {
  background: var(--warn-light);
  color: var(--warn);
}
.zc-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.zc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--surface-2);
  font-size: 13px;
}
.zc-item.near {
  background: var(--warn-light);
}
.zc-item.expired {
  background: var(--danger-light);
}
.zi-emoji {
  font-size: 16px;
}
.zi-name {
  font-weight: 500;
  cursor: pointer;
}
.zi-name:hover {
  color: var(--primary-dark);
}
.zi-qty {
  font-size: 12px;
}
.zi-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.zi-actions button {
  border: none;
  background: transparent;
  color: var(--primary-dark);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.zi-actions button:hover {
  background: #fff;
}
.zi-actions .del {
  color: var(--danger);
}

/* 列表视图 */
.item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.thumb {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
}
.thumb.icon {
  font-size: 26px;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.head-info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
  font-size: 15px;
}
.meta {
  font-size: 12px;
}
.item-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.small {
  font-size: 12px;
}
.note {
  font-size: 12px;
  color: var(--text-2);
  background: var(--surface-2);
  padding: 6px 10px;
  border-radius: 8px;
}
.item-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
</style>
