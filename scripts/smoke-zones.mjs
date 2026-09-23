// 分区功能冒烟测试：用 Vite SSR 加载真实源码，mock localStorage 验证核心逻辑
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    dump: () => Object.fromEntries(map),
  }
}

let failures = 0
function assert(cond, msg) {
  if (cond) console.log('  ✅', msg)
  else {
    failures++
    console.error('  ❌', msg)
  }
}

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })

async function freshEnv(initialStorage) {
  globalThis.localStorage = createMemoryStorage(initialStorage)
  setActivePinia(createPinia())
  const inventory = await server.ssrLoadModule('/src/stores/inventory.js')
  const zones = await server.ssrLoadModule('/src/stores/zones.js')
  return {
    inventory: inventory.useInventoryStore(),
    zones: zones.useZonesStore(),
    storage: globalThis.localStorage,
  }
}

// 场景 1：历史数据迁移（只有三档位置，没有分区）
{
  console.log('\n场景1：首次进入播种默认分区 + 历史食材迁移')
  const { inventory, zones, storage } = await freshEnv({
    'fam-meal:inventory': JSON.stringify([
      { id: 'a', name: '番茄', location: '冷藏', quantity: 2, unit: '个' },
      { id: 'b', name: '牛排', location: '冷冻', quantity: 1, unit: '块' },
      { id: 'c', name: '酱油', location: '常温', quantity: 1, unit: '瓶' },
    ]),
  })
  zones.migrate()
  assert(zones.zones.length === 7, `播种 7 个默认分区（实际 ${zones.zones.length}）`)
  const cool = inventory.items.find((i) => i.id === 'a')
  const freeze = inventory.items.find((i) => i.id === 'b')
  const room = inventory.items.find((i) => i.id === 'c')
  assert(zones.zoneMap[cool.zoneId]?.type === '冷藏', '冷藏食材归入冷藏分区')
  assert(zones.zoneMap[freeze.zoneId]?.type === '冷冻', '冷冻食材归入冷冻分区')
  assert(zones.zoneMap[room.zoneId]?.type === '常温', '常温食材归入常温分区')
  assert(!!storage.getItem('fam-meal:zones'), '分区已持久化')
  // 迁移幂等：再跑一次不应改动
  const before = inventory.items.map((i) => i.zoneId).join(',')
  zones.migrate()
  assert(inventory.items.map((i) => i.zoneId).join(',') === before, '迁移幂等，重复执行不改变归属')
}

// 场景 2：新增分区校验
{
  console.log('\n场景2：自定义分区与校验')
  const { zones } = await freshEnv()
  zones.migrate()
  const z = zones.addZone({ name: '门架搁板', type: '冷藏', icon: '🥤' })
  assert(z.id && z.name === '门架搁板' && z.type === '冷藏', '新建分区成功')
  let threw = false
  try {
    zones.addZone({ name: '冷藏室上层', type: '冷藏' })
  } catch {
    threw = true
  }
  assert(threw, '同类型下重名被拒绝')
  zones.updateZone(z.id, { name: '门架第二层', icon: '🥚' })
  assert(zones.zoneMap[z.id].name === '门架第二层', '分区可改名')
}

// 场景 3：删除分区 → 食材迁移到同类型其它分区；最后一个分区不可删
{
  console.log('\n场景3：删除分区的食材迁移与保护规则')
  const { inventory, zones } = await freshEnv()
  zones.migrate()
  const coolZones = zones.byType['冷藏']
  const [first, second] = coolZones
  inventory.addItem({ name: '牛奶', location: '冷藏', zoneId: first.id, purchaseDate: '2026-09-20', shelfLifeDays: 7 })
  zones.removeZone(first.id, second.id)
  const milk = inventory.items.find((i) => i.name === '牛奶')
  assert(milk.zoneId === second.id && milk.location === '冷藏', '删除后食材迁入目标分区')
  assert(!zones.zoneMap[first.id], '原分区已删除')

  // 自定义类型只剩一个时不可删（把冷冻、常温分区全删掉，再删冷藏至最后一个）
  const freeze = zones.byType['冷冻']
  let threw = false
  try {
    zones.removeZone(freeze[0].id, freeze[1].id)
    zones.removeZone(freeze[1].id, '')
  } catch {
    threw = true
  }
  assert(threw, '某存放方式只剩一个分区时禁止删除')
}

// 场景 4：入库默认分区 + 换分区联动存放方式
{
  console.log('\n场景4：采购入库默认分区与换分区联动')
  const { inventory, zones } = await freshEnv()
  zones.migrate()
  inventory.restock({ name: '土豆', unit: '个', quantity: 3, category: '蔬菜', location: '常温' })
  const potato = inventory.items.find((i) => i.name === '土豆')
  assert(zones.zoneMap[potato.zoneId]?.type === '常温', '未指定分区时落到常温默认分区')

  inventory.restock({ name: '土豆', unit: '个', quantity: 2, category: '蔬菜', location: '常温' })
  const potato2 = inventory.items.find((i) => i.name === '土豆')
  assert(potato2.quantity === 5, '同名同单位食材入库累加数量')

  const freezeZone = zones.byType['冷冻'][0]
  inventory.updateItem(potato2.id, { zoneId: freezeZone.id })
  const updated = inventory.items.find((i) => i.id === potato2.id)
  assert(updated.location === '冷冻' && updated.zoneId === freezeZone.id, '换分区时存放方式联动为冷冻')
}

// 场景 5：盘点记录
{
  console.log('\n场景5：分区盘点记录时间')
  const { zones } = await freshEnv()
  zones.migrate()
  const z = zones.ordered[0]
  zones.markChecked(z.id)
  assert(zones.zoneMap[z.id].lastCheckedAt === new Date().toISOString().slice(0, 10), '盘点日期已记录')
}

await server.close()
console.log(failures ? `\n❌ ${failures} 项断言失败` : '\n🎉 全部断言通过')
process.exit(failures ? 1 : 0)
