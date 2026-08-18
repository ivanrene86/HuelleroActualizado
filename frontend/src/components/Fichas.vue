<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const editingId = ref(null)
const loading = ref(false)

const busquedaDocente = ref('')

const fichaForm = reactive({
  codigoFicha: '',
  nombrePrograma: '',
  jornada: 'Diurna',
  aulaAsignada: '',
  instructorLiderId: null,
  instructores: [], // Instructores Comunes
  fechaInicio: '',
  fechaFin: '',
})

const fichas = ref([])
const instructoresList = ref([])

onMounted(async () => {
  await Promise.all([loadFichas(), loadInstructores()])
})

async function loadFichas() {
  try {
    fichas.value = await api.fichas.getAll()
  } catch (e) {
    showToastFn('Error al cargar fichas', 'error')
  }
}

async function loadInstructores() {
  try {
    instructoresList.value = await api.instructores.getAll()
  } catch (e) {}
}

const instructoresFiltrados = computed(() => {
  const query = busquedaDocente.value.toLowerCase().trim()
  const activos = instructoresList.value.filter(i => i.estado !== 'Inactivo')
  if (!query) return activos
  return activos.filter(i => 
    `${i.nombres} ${i.apellidos} ${i.numeroDocumento || ''} ${i.especialidad || ''} ${i.correo || ''}`.toLowerCase().includes(query)
  )
})

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function openCreate() {
  editingId.value = null
  busquedaDocente.value = ''
  Object.assign(fichaForm, {
    codigoFicha: '',
    nombrePrograma: '',
    jornada: 'Diurna',
    aulaAsignada: '',
    instructorLiderId: null,
    instructores: [],
    fechaInicio: '',
    fechaFin: '',
  })
  showModal.value = true
}

function openEdit(ficha) {
  editingId.value = ficha._id
  busquedaDocente.value = ''
  const comunesIds = Array.isArray(ficha.instructores)
    ? ficha.instructores.map(i => i._id || i)
    : []

  Object.assign(fichaForm, {
    codigoFicha: ficha.codigoFicha,
    nombrePrograma: ficha.nombrePrograma,
    jornada: ficha.jornada,
    aulaAsignada: ficha.aulaAsignada,
    instructorLiderId: ficha.instructorLiderId?._id || ficha.instructorLiderId || null,
    instructores: comunesIds,
    fechaInicio: ficha.fechaInicio,
    fechaFin: ficha.fechaFin,
  })
  showModal.value = true
}

function toggleInstructorComun(id) {
  const index = fichaForm.instructores.indexOf(id)
  if (index > -1) {
    fichaForm.instructores.splice(index, 1)
  } else {
    fichaForm.instructores.push(id)
  }
}

function closeModal() {
  showModal.value = false
}

async function guardarFicha() {
  const { codigoFicha, nombrePrograma, jornada, aulaAsignada, instructorLiderId, instructores, fechaInicio, fechaFin } = fichaForm
  if (!codigoFicha || !nombrePrograma || !jornada || !aulaAsignada || !instructorLiderId || !fechaInicio || !fechaFin) {
    showToastFn('Completa todos los campos obligatorios', 'error')
    return
  }
  loading.value = true
  try {
    const comunesFiltrados = instructores.filter(id => id !== instructorLiderId)
    const body = {
      codigoFicha,
      nombrePrograma,
      jornada,
      aulaAsignada,
      instructorLiderId,
      instructores: comunesFiltrados,
      fechaInicio,
      fechaFin
    }
    if (editingId.value) {
      await api.fichas.update(editingId.value, body)
      showToastFn('Ficha actualizada correctamente')
    } else {
      await api.fichas.create(body)
      showToastFn('Ficha creada correctamente')
    }
    await loadFichas()
    closeModal()
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function eliminarFicha(id) {
  if (!confirm('¿Estás seguro de eliminar esta ficha?')) return
  try {
    await api.fichas.delete(id)
    await loadFichas()
    showToastFn('Ficha eliminada correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function getInstructorNombre(id) {
  if (!id) return 'No asignado'
  const instId = id._id || id
  const instructor = instructoresList.value.find(i => i._id === instId)
  return instructor ? `${instructor.nombres} ${instructor.apellidos}` : (id.nombres ? `${id.nombres} ${id.apellidos}` : 'No asignado')
}

function getComunesNombres(comunes) {
  if (!comunes || comunes.length === 0) return 'Ninguno'
  return comunes
    .map(c => getInstructorNombre(c))
    .filter(n => n !== 'No asignado')
    .join(', ') || 'Ninguno'
}

function jornadaBadge(jornada) {
  if (jornada === 'Mañana' || jornada === 'Diurna') return 'badge-primary'
  if (jornada === 'Tarde' || jornada === 'Mixta') return 'badge-warning'
  return 'badge-success'
}

const liderYaEsLiderEnOtraFicha = computed(() => {
  if (!fichaForm.instructorLiderId) return null
  const lidId = fichaForm.instructorLiderId
  return fichas.value.find(f => f._id !== editingId.value && (f.instructorLiderId?._id === lidId || f.instructorLiderId === lidId))
})
</script>

<template>
  <div class="page-header">
    <h1>Gestión de Fichas</h1>
    <p>Asigna Instructores Líderes e Instructores Comunes a las fichas</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Listado de Fichas</h3>
      <button class="btn btn-primary" @click="openCreate">+ Nueva Ficha</button>
    </div>

    <div v-if="fichas.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <p>No hay fichas registradas. Crea la primera usando el botón "Nueva Ficha".</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Código Ficha</th>
            <th>Programa</th>
            <th>Jornada</th>
            <th>Aula</th>
            <th>Docente Líder 👑</th>
            <th>Docentes Comunes 👤</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fichas" :key="f._id">
            <td><strong>{{ f.codigoFicha }}</strong></td>
            <td>{{ f.nombrePrograma }}</td>
            <td><span class="badge" :class="jornadaBadge(f.jornada)">{{ f.jornada }}</span></td>
            <td>{{ f.aulaAsignada }}</td>
            <td>
              <span class="badge badge-lider">
                👑 {{ getInstructorNombre(f.instructorLiderId) }}
              </span>
            </td>
            <td>
              <span class="comunes-text">
                {{ getComunesNombres(f.instructores) }}
              </span>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn-outline btn-sm" @click="openEdit(f)">✏️ Editar</button>
                <button class="btn btn-danger btn-sm" @click="eliminarFicha(f._id)">🗑️ Eliminar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL DE CREACIÓN / EDICIÓN DE FICHA -->
  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal modal-lg">
      <h2>{{ editingId ? '✏️ Editar Ficha' : '➕ Nueva Ficha' }}</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Código de Ficha *</label>
          <input v-model="fichaForm.codigoFicha" type="text" placeholder="Ej: 2670123" />
        </div>
        <div class="form-group">
          <label>Nombre del Programa *</label>
          <input v-model="fichaForm.nombrePrograma" type="text" placeholder="Ej: Análisis y Desarrollo de Software" />
        </div>
        <div class="form-group">
          <label>Jornada *</label>
          <select v-model="fichaForm.jornada">
            <option value="Mañana">🌅 Mañana</option>
            <option value="Tarde">☀️ Tarde</option>
            <option value="Noche">🌙 Noche</option>
          </select>
        </div>
        <div class="form-group">
          <label>Aula Asignada *</label>
          <input v-model="fichaForm.aulaAsignada" type="text" placeholder="Ej: Aula 302 - Bloque A" />
        </div>

        <!-- BUSCADOR DE DOCENTES -->
        <div class="form-group" style="grid-column: span 2;">
          <label>🔍 Filtrar / Buscar Docente en la Lista</label>
          <input
            v-model="busquedaDocente"
            type="text"
            placeholder="Escribe el nombre, apellido, documento o especialidad del docente..."
            class="input-search-docente"
          />
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label>👑 Docente Líder de la Ficha (Obligatorio) *</label>
          <select v-model="fichaForm.instructorLiderId" class="select-lider">
            <option :value="null" disabled>Selecciona al Docente Líder...</option>
            <option v-for="i in instructoresFiltrados" :key="i._id" :value="i._id">
              👑 {{ i.nombres }} {{ i.apellidos }} — {{ i.especialidad }}
            </option>
          </select>
          <p v-if="instructoresFiltrados.length === 0" class="help-text-warning">
            No se encontraron docentes con la búsqueda "{{ busquedaDocente }}".
          </p>
          <p v-if="liderYaEsLiderEnOtraFicha" class="help-text-warning">
            ⚠️ <strong>Aviso de Liderazgo:</strong> Este docente ya es Líder de la Ficha <strong>{{ liderYaEsLiderEnOtraFicha.codigoFicha }}</strong> ({{ liderYaEsLiderEnOtraFicha.nombrePrograma }}). Se permite ser líder de múltiples fichas.
          </p>
        </div>

        <div class="form-group" style="grid-column: span 2;">
          <label>👤 Docentes Comunes Asignados (Opcional)</label>
          <p class="help-text">Selecciona los docentes adicionales que dictan clases en esta ficha:</p>
          <div class="fichas-check-grid">
            <label
              v-for="i in instructoresFiltrados"
              :key="i._id"
              class="ficha-check-item"
              :class="{ disabled: i._id === fichaForm.instructorLiderId }"
            >
              <input
                type="checkbox"
                :value="i._id"
                :checked="fichaForm.instructores.includes(i._id)"
                :disabled="i._id === fichaForm.instructorLiderId"
                @change="toggleInstructorComun(i._id)"
              />
              <span>
                {{ i.nombres }} {{ i.apellidos }}
                <small v-if="i._id === fichaForm.instructorLiderId" style="color: #16a34a; font-weight: bold;"> (Líder principal)</small>
              </span>
            </label>
            <div v-if="instructoresFiltrados.length === 0" style="padding: 12px; color: #94a3b8; font-size: 13px; text-align: center;">
              No se encontraron docentes que coincidan con la búsqueda.
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Fecha de Inicio *</label>
          <input v-model="fichaForm.fechaInicio" type="date" />
        </div>
        <div class="form-group">
          <label>Fecha de Fin *</label>
          <input v-model="fichaForm.fechaFin" type="date" />
        </div>
      </div>
      <div class="btn-group" style="margin-top: 24px; justify-content: flex-end;">
        <button class="btn btn-outline" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" @click="guardarFicha" :disabled="loading">
          {{ loading ? 'Guardando...' : (editingId ? '💾 Actualizar Ficha' : '➕ Crear Ficha') }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>

<style scoped>
.modal-lg {
  max-width: 650px;
  width: 95vw;
}

.input-search-docente {
  padding: 10px 14px;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  background: #f8fafc;
  transition: all 0.2s;
}

.input-search-docente:focus {
  outline: none;
  border-color: #2563eb;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.badge-lider {
  background: #dcfce7;
  color: #15803d;
  font-weight: 700;
}

.comunes-text {
  font-size: 12px;
  color: #475569;
}

.select-lider {
  border: 2px solid #22c55e !important;
  font-weight: 600;
  background: #f0fdf4 !important;
}

.help-text {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

.fichas-check-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}

.ficha-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.ficha-check-item:hover:not(.disabled) {
  border-color: #3b82f6;
  background: #eff6ff;
}

.ficha-check-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f1f5f9;
}

.help-text-warning {
  font-size: 12px;
  color: #854d0e;
  background: #fefce8;
  border: 1px solid #fef08a;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 6px;
}
</style>
