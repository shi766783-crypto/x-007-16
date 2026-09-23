<script setup>
import { reactive, computed, ref, watch } from 'vue'
import { CATEGORIES, UNITS, LOCATIONS, LOCATION_ICONS } from '@/constants'
import { toDateKey, expiryDateKey } from '@/utils/date'
import PhotoUpload from '@/components/common/PhotoUpload.vue'
import { useZonesStore } from '@/stores/zones'

const props = defineProps({
  initial: { type: Object, default: null },
})
const emit = defineEmits(['submit', 'cancel'])

const zones = useZonesStore()

const form = reactive({
  name: props.initial?.name || '',
  category: props.initial?.category || '蔬菜',
  quantity: props.initial?.quantity ?? 1,
  unit: props.initial?.unit || '个',
  purchaseDate: props.initial?.purchaseDate || toDateKey(),
  shelfLifeDays: props.initial?.shelfLifeDays ?? 7,
  location: props.initial?.location || '冷藏',
  zoneId: props.initial?.zoneId || '',
  note: props.initial?.note || '',
  photo: props.initial?.photo || '',
})

// 当前存放方式下可选的具体分区
const zoneOptions = computed(() => zones.byType[form.location] || [])

// 初始 zoneId 与 location 不一致（如旧数据或默认值）时，回退到该方式的第一个分区
watch(
  zoneOptions,
  (list) => {
    if (!list.some((z) => z.id === form.zoneId)) {
      form.zoneId = list[0]?.id || ''
    }
  },
  { immediate: true },
)

// 切换存放方式时分区随之切换；并顺手新建分区
function changeLocation(type) {
  form.location = type
  form.zoneId = zoneOptions.value[0]?.id || ''
}

const creating = ref(false)
const newZoneName = ref('')

function toggleCreate() {
  creating.value = !creating.value
  newZoneName.value = ''
}

function confirmCreate() {
  const name = newZoneName.value.trim()
  if (!name) return
  try {
    const zone = zones.addZone({ name, type: form.location })
    form.zoneId = zone.id
    creating.value = false
    newZoneName.value = ''
  } catch (e) {
    alert(e.message)
  }
}

const expiry = computed(() =>
  form.purchaseDate ? expiryDateKey(form.purchaseDate, Number(form.shelfLifeDays)) : '',
)

function submit() {
  if (!form.name.trim()) return
  if (!form.zoneId) {
    alert('请先选择或新建一个存放分区')
    return
  }
  emit('submit', {
    ...form,
    name: form.name.trim(),
    quantity: Number(form.quantity),
    shelfLifeDays: Number(form.shelfLifeDays),
  })
}
</script>

<template>
  <form class="ingredient-form" @submit.prevent="submit">
    <div class="field">
      <label>名称 *</label>
      <input v-model="form.name" type="text" placeholder="如：番茄" required />
    </div>

    <div class="row">
      <div class="field">
        <label>类别</label>
        <select v-model="form.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="field">
        <label>存放方式</label>
        <select :value="form.location" @change="changeLocation($event.target.value)">
          <option v-for="l in LOCATIONS" :key="l" :value="l">{{ LOCATION_ICONS[l] }} {{ l }}</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>存放分区 *</label>
      <div class="zone-picker">
        <select v-model="form.zoneId" class="zone-select">
          <option v-for="z in zoneOptions" :key="z.id" :value="z.id">
            {{ z.icon }} {{ z.name }}
          </option>
        </select>
        <button type="button" class="zone-new" @click="toggleCreate">
          {{ creating ? '取消' : '+ 新建分区' }}
        </button>
      </div>
      <div v-if="creating" class="zone-create">
        <input
          v-model="newZoneName"
          type="text"
          :placeholder="`在「${form.location}」下新建分区，如：门架搁板`"
          @keyup.enter.prevent="confirmCreate"
        />
        <button type="button" class="zone-confirm" @click="confirmCreate">创建</button>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>数量</label>
        <input v-model.number="form.quantity" type="number" min="0" step="0.01" />
      </div>
      <div class="field">
        <label>单位</label>
        <select v-model="form.unit">
          <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>购买日期</label>
        <input v-model="form.purchaseDate" type="date" />
      </div>
      <div class="field">
        <label>保质期（天）</label>
        <input v-model.number="form.shelfLifeDays" type="number" min="1" />
      </div>
    </div>

    <div class="field">
      <label>预计过期日期</label>
      <div class="expiry-hint">{{ expiry || '—' }}</div>
    </div>

    <div class="field">
      <label>备注</label>
      <textarea v-model="form.note" rows="2" placeholder="可选备注"></textarea>
    </div>

    <div class="field">
      <label>食材照片（可选）</label>
      <PhotoUpload v-model="form.photo" />
    </div>

    <div class="actions">
      <button type="button" class="btn-cancel" @click="emit('cancel')">取消</button>
      <button type="submit" class="btn-submit">保存</button>
    </div>
  </form>
</template>

<style scoped>
.ingredient-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
.zone-picker {
  display: flex;
  gap: 8px;
}
.zone-select {
  flex: 1;
}
.zone-new {
  border: 1px dashed var(--primary);
  background: var(--primary-light);
  color: var(--primary-dark);
  border-radius: 8px;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.zone-create {
  display: flex;
  gap: 8px;
}
.zone-create input {
  flex: 1;
}
.zone-confirm {
  border: none;
  background: var(--primary);
  color: #fff;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 13px;
  cursor: pointer;
}
.expiry-hint {
  padding: 8px 12px;
  background: var(--surface-2);
  border-radius: 8px;
  color: var(--warn);
  font-weight: 600;
}
.actions {
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
