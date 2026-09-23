import { defineStore } from 'pinia'
import { read, write } from '@/utils/storage'
import { uid } from '@/utils/id'
import { LOCATIONS } from '@/constants'
import { useInventoryStore } from './inventory'

const STORAGE_KEY = 'zones'

// 首次使用时的默认分区，用户可自由增删改
const DEFAULT_ZONES = [
  { name: '冷藏·上层', location: '冷藏', icon: '🥛' },
  { name: '冷藏·下层', location: '冷藏', icon: '🥬' },
  { name: '蔬果盒', location: '冷藏', icon: '🍎' },
  { name: '冷冻·抽屉', location: '冷冻', icon: '🧊' },
  { name: '储物柜', location: '常温', icon: '🗄️' },
]

function seed() {
  return DEFAULT_ZONES.map((z) => ({ id: uid('zone'), note: '', ...z }))
}

export const useZoneStore = defineStore('zones', {
  state: () => {
    let zones = read(STORAGE_KEY, null)
    if (!Array.isArray(zones)) {
      zones = seed()
      write(STORAGE_KEY, zones)
    }
    return { zones }
  },

  getters: {
    zoneMap(state) {
      return Object.fromEntries(state.zones.map((z) => [z.id, z]))
    },
    // 按存放位置分组：{ 冷藏: [...], 冷冻: [...], 常温: [...] }
    byLocation(state) {
      const map = Object.fromEntries(LOCATIONS.map((l) => [l, []]))
      state.zones.forEach((z) => {
        if (!map[z.location]) map[z.location] = []
        map[z.location].push(z)
      })
      return map
    },
    zonesOf(state) {
      return (location) => state.zones.filter((z) => z.location === location)
    },
    // 每个分区的库存统计（key 为 zoneId，'' 表示未分配）：{ total, near, expired }
    stats() {
      const inventory = useInventoryStore()
      const map = {}
      inventory.withExpiry.forEach((item) => {
        const key = item.zoneId || ''
        if (!map[key]) map[key] = { total: 0, near: 0, expired: 0 }
        map[key].total += 1
        if (item.status === 'near') map[key].near += 1
        else if (item.status === 'expired') map[key].expired += 1
      })
      return map
    },
  },

  actions: {
    persist() {
      write(STORAGE_KEY, this.zones)
    },

    addZone(data) {
      const zone = { id: uid('zone'), name: '', location: '冷藏', icon: '📦', note: '', ...data }
      this.zones.push(zone)
      this.persist()
      return zone
    },

    updateZone(id, patch) {
      const idx = this.zones.findIndex((z) => z.id === id)
      if (idx === -1) return
      this.zones[idx] = { ...this.zones[idx], ...patch }
      this.persist()
    },

    // 删除分区后，其中的食材重置为「未分配」
    removeZone(id) {
      this.zones = this.zones.filter((z) => z.id !== id)
      this.persist()
      const inventory = useInventoryStore()
      inventory.items.forEach((i) => {
        if (i.zoneId === id) inventory.updateItem(i.id, { zoneId: '' })
      })
    },

    nameOf(id) {
      return this.zoneMap[id]?.name || ''
    },
  },
})
