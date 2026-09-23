import { defineStore } from 'pinia'
import { read, write } from '@/utils/storage'
import { uid } from '@/utils/id'
import { toDateKey } from '@/utils/date'
import { LOCATIONS } from '@/constants'
import { useInventoryStore } from '@/stores/inventory'

const STORAGE_KEY = 'zones'

// 首次使用时的默认分区：按常见冰箱格局为三种存放方式各建几个区域
const DEFAULT_ZONES = [
  { id: 'zone-def-cool-1', name: '冷藏室上层', type: '冷藏', icon: '🥛' },
  { id: 'zone-def-cool-2', name: '冷藏室下层', type: '冷藏', icon: '🥬' },
  { id: 'zone-def-cool-3', name: '保鲜抽屉', type: '冷藏', icon: '🥗' },
  { id: 'zone-def-freeze-1', name: '冷冻室上层', type: '冷冻', icon: '🧆' },
  { id: 'zone-def-freeze-2', name: '冷冻室下层', type: '冷冻', icon: '🍦' },
  { id: 'zone-def-room-1', name: '调料柜', type: '常温', icon: '🧂' },
  { id: 'zone-def-room-2', name: '常温储物架', type: '常温', icon: '📦' },
]

function createZone({ name, type, icon = '📦' }) {
  return {
    id: uid('zone'),
    name,
    type,
    icon,
    createdAt: new Date().toISOString(),
    lastCheckedAt: '',
  }
}

export const useZonesStore = defineStore('zones', {
  state: () => ({
    zones: read(STORAGE_KEY, []),
  }),

  getters: {
    // 按存放方式分组
    byType(state) {
      const map = { 冷藏: [], 冷冻: [], 常温: [] }
      state.zones.forEach((z) => {
        if (!map[z.type]) map[z.type] = []
        map[z.type].push(z)
      })
      return map
    },
    // 按 冷藏 → 冷冻 → 常温 的固定顺序排列
    ordered() {
      return LOCATIONS.flatMap((t) => this.byType[t] || [])
    },
    zoneMap(state) {
      const map = {}
      state.zones.forEach((z) => {
        map[z.id] = z
      })
      return map
    },
  },

  actions: {
    persist() {
      write(STORAGE_KEY, this.zones)
    },

    // 查区域名（找不到时回退到占位文案）
    nameOf(id, fallback = '未指定区域') {
      return this.zoneMap[id]?.name || fallback
    },

    addZone({ name, type, icon }) {
      const trimmed = (name || '').trim()
      if (!trimmed) throw new Error('区域名称不能为空')
      const list = this.byType[type] || []
      if (list.some((z) => z.name === trimmed)) throw new Error('该存放方式下已存在同名区域')
      const zone = createZone({ name: trimmed, type, icon: icon || '📦' })
      this.zones.push(zone)
      this.persist()
      return zone
    },

    updateZone(id, patch) {
      const zone = this.zones.find((z) => z.id === id)
      if (!zone) return
      const next = { ...zone, ...patch }
      if (patch.name !== undefined) {
        next.name = patch.name.trim()
        if (!next.name) throw new Error('区域名称不能为空')
        const dup = this.zones.some((z) => z.id !== id && z.type === next.type && z.name === next.name)
        if (dup) throw new Error('该存放方式下已存在同名区域')
      }
      Object.assign(zone, { name: next.name, icon: next.icon })
      this.persist()
    },

    // 删除分区；该分区下的食材统一移动到 moveToId 指向的分区
    removeZone(id, moveToId) {
      const zone = this.zoneMap[id]
      if (!zone) return
      if (this.byType[zone.type].length <= 1) {
        throw new Error('每种存放方式至少要保留一个分区')
      }
      const target = this.zoneMap[moveToId]
      if (!target) throw new Error('请选择食材要移往的分区')

      const inventory = useInventoryStore()
      inventory.items.forEach((item) => {
        if (item.zoneId === id) {
          item.zoneId = target.id
          item.location = target.type
        }
      })
      inventory.persist()

      this.zones = this.zones.filter((z) => z.id !== id)
      this.persist()
    },

    // 记录分区盘点时间
    markChecked(id) {
      const zone = this.zoneMap[id]
      if (!zone) return
      zone.lastCheckedAt = toDateKey()
      this.persist()
    },

    // 首次进入：播种默认分区，并把历史食材（只有三档位置、没有分区）迁移到对应默认分区
    migrate() {
      if (read(STORAGE_KEY) === null) {
        this.zones = DEFAULT_ZONES.map((z) => ({ ...z, lastCheckedAt: '' }))
        this.persist()
      }

      const inventory = useInventoryStore()
      let changed = false
      inventory.items.forEach((item) => {
        const valid = item.zoneId && this.zoneMap[item.zoneId]
        if (!valid) {
          const fallback = this.byType[item.location]?.[0] || this.zones[0]
          if (fallback) {
            item.zoneId = fallback.id
            changed = true
          }
        }
      })
      if (changed) inventory.persist()
    },
  },
})
