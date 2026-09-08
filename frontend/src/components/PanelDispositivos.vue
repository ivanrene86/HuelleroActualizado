<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../services/api.js'

const dispositivos = ref([])
const fichas = ref([])
const selecciones = reactive({})
const loading = ref(false)
const savingId = ref(null)
const toast = ref({ show: false, message: '', type: '' })

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadDispositivos(), loadFichas()])
  } finally {
    loading.value = false
  }
})

async function loadDispositivos() {
  const data = await api.dispositivos.listar()
  dispositivos.value = data
  for (const d of dispositivos.value) {
    selecciones[d._id] = (d.fichas || []).map(f => f._id || f)
  }
}

async function loadFichas() {
  fichas.value = await api.fichas.getAll()
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function deviceLabel(d) {
  return d.nombre || d.deviceId || d._id
}

function toggleFicha(deviceId, fichaId) {
  const arr = selecciones[deviceId]
  if (!Array.isArray(arr)) return
  const i = arr.indexOf(fichaId)
  if (i > -1) arr.splice(i, 1)
  else arr.push(fichaId)
}

function getDispositivoDeFicha(fichaId) {
  return dispositivos.value.find(d => (d.fichas || []).some(f => String(f._id || f) === String(fichaId))) || null
}

async function guardar(device) {
  savingId.value = device._id
  try {
    await api.dispositivos.asociarFichas(device._id, selecciones[device._id] || [])
    showToast('Asociación guardada correctamente')
    await loadDispositivos()
  } catch (e) {
    showToast('Error: ' + (e.message || 'No se pudo guardar'), 'error')
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <div class="page-header">
    <h1>Dispositivos / Huelleros</h1>
    <p>Asocia fichas a cada lector físico. Una ficha solo puede estar asociada a un dispositivo a la vez.</p>
  </div>

  <div v-if="loading" class="empty-state"><p>Cargando dispositivos…</p></div>

  <div v-else-if="dispositivos.length === 0" class="empty-state">
    <p>No hay dispositivos registrados todavía. La app del huellero se registra automáticamente al iniciar.</p>
  </div>

  <div v-else class="dispositivos-list">
    <div v-for="d in dispositivos" :key="d._id" class="card">
      <div class="card-header">
        <div>
          <h3>{{ deviceLabel(d) }}</h3>
          <span class="device-id">{{ d.nombre ? d.deviceId : '' }}</span>
          <span class="badge" :class="d.activo ? 'badge-success' : 'badge-danger'">
            {{ d.activo ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
        <button class="btn btn-primary btn-sm" :disabled="savingId === d._id" @click="guardar(d)">
          {{ savingId === d._id ? 'Guardando…' : '💾 Guardar' }}
        </button>
      </div>

      <div class="fichas-asociadas">
        <strong>Fichas asociadas:</strong>
        <template v-if="(d.fichas || []).length === 0">
          <span class="muted">Ninguna</span>
        </template>
        <span v-for="f in d.fichas" :key="f._id" class="badge badge-ficha">
          {{ f.codigoFicha }} · {{ f.nombrePrograma }}
        </span>
      </div>

      <div class="selector-label">Selecciona las fichas que debe atender este dispositivo:</div>
      <div class="dispositivo-fichas-grid">
        <label v-for="f in fichas" :key="f._id" class="dispositivo-ficha-item">
          <input
            type="checkbox"
            :checked="selecciones[d._id].includes(f._id)"
            @change="toggleFicha(d._id, f._id)"
          />
          <span>
            {{ f.codigoFicha }} · {{ f.nombrePrograma }}
            <small
              v-if="getDispositivoDeFicha(f._id) && getDispositivoDeFicha(f._id)._id !== d._id"
              class="move-hint"
              :class="{ 'move-active': selecciones[d._id].includes(f._id) }"
            >
              {{ selecciones[d._id].includes(f._id) ? '⚠️ se moverá desde' : 'en' }} {{ deviceLabel(getDispositivoDeFicha(f._id)) }}
            </small>
          </span>
        </label>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>

<style scoped>
.dispositivos-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.device-id {
  display: inline-block;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--mono);
  margin-right: 8px;
}

.fichas-asociadas {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
}

.muted {
  color: var(--text-secondary);
}

.selector-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.dispositivo-fichas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}

.dispositivo-ficha-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.dispositivo-ficha-item:hover {
  background: var(--bg);
}

.dispositivo-ficha-item input {
  margin-top: 3px;
}

.move-hint {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
}

.move-hint.move-active {
  color: #b45309;
  font-weight: 600;
}
</style>
