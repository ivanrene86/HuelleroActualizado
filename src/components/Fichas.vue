<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const editingId = ref(null)
const loading = ref(false)

const fichaForm = reactive({
  codigoFicha: '', nombrePrograma: '', jornada: 'Diurna',
  aulaAsignada: '', instructorLiderId: null, fechaInicio: '', fechaFin: '',
})

const fichas = ref([])
const instructoresList = ref([])

onMounted(async () => {
  await Promise.all([loadFichas(), loadInstructores()])
})

async function loadFichas() {
  try { fichas.value = await api.fichas.getAll() } catch (e) { showToastFn('Error al cargar fichas', 'error') }
}

async function loadInstructores() {
  try { instructoresList.value = await api.instructores.getAll() } catch (e) {}
}

function instructoresActivos() {
  return instructoresList.value.filter(i => i.estado !== 'Inactivo')
}

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function openCreate() {
  editingId.value = null
  Object.assign(fichaForm, {
    codigoFicha: '', nombrePrograma: '', jornada: 'Diurna',
    aulaAsignada: '', instructorLiderId: null, fechaInicio: '', fechaFin: '',
  })
  showModal.value = true
}

function openEdit(ficha) {
  editingId.value = ficha._id
  Object.assign(fichaForm, {
    codigoFicha: ficha.codigoFicha, nombrePrograma: ficha.nombrePrograma,
    jornada: ficha.jornada, aulaAsignada: ficha.aulaAsignada,
    instructorLiderId: ficha.instructorLiderId?._id || ficha.instructorLiderId || null,
    fechaInicio: ficha.fechaInicio, fechaFin: ficha.fechaFin,
  })
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function guardarFicha() {
  const { codigoFicha, nombrePrograma, jornada, aulaAsignada, instructorLiderId, fechaInicio, fechaFin } = fichaForm
  if (!codigoFicha || !nombrePrograma || !jornada || !aulaAsignada || !instructorLiderId || !fechaInicio || !fechaFin) {
    showToastFn('Completa todos los campos obligatorios', 'error')
    return
  }
  loading.value = true
  try {
    const body = { codigoFicha, nombrePrograma, jornada, aulaAsignada, instructorLiderId, fechaInicio, fechaFin }
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
  try {
    await api.fichas.delete(id)
    await loadFichas()
    showToastFn('Ficha eliminada correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function getInstructorNombre(id) {
  if (!id) return '—'
  const instructor = instructoresList.value.find(i => i._id === id._id || i._id === id)
  return instructor ? `${instructor.nombres} ${instructor.apellidos}` : 'No asignado'
}

function jornadaBadge(jornada) {
  if (jornada === 'Diurna') return 'badge-primary'
  if (jornada === 'Nocturna') return 'badge-warning'
  return 'badge-success'
}
</script>

<template>
  <div class="page-header">
    <h1>Fichas</h1>
    <p>Gestiona las fichas, aulas y jornadas</p>
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
      <p>No hay fichas registradas. Crea la primera usando el boton "Nueva Ficha".</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Codigo Ficha</th><th>Programa</th><th>Jornada</th><th>Aula</th>
            <th>Instructor Lider</th><th>Fecha Inicio</th><th>Fecha Fin</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fichas" :key="f._id">
            <td><strong>{{ f.codigoFicha }}</strong></td>
            <td>{{ f.nombrePrograma }}</td>
            <td><span class="badge" :class="jornadaBadge(f.jornada)">{{ f.jornada }}</span></td>
            <td>{{ f.aulaAsignada }}</td>
            <td>{{ getInstructorNombre(f.instructorLiderId) }}</td>
            <td>{{ f.fechaInicio }}</td>
            <td>{{ f.fechaFin }}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-outline btn-sm" @click="openEdit(f)">Editar</button>
                <button class="btn btn-danger btn-sm" @click="eliminarFicha(f._id)">Eliminar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <h2>{{ editingId ? 'Editar Ficha' : 'Nueva Ficha' }}</h2>
      <div class="form-grid">
        <div class="form-group"><label>Codigo de Ficha</label><input v-model="fichaForm.codigoFicha" type="text" placeholder="Ej: 1234567" /></div>
        <div class="form-group"><label>Nombre del Programa</label><input v-model="fichaForm.nombrePrograma" type="text" placeholder="Ej: Analisis y Desarrollo de Software" /></div>
        <div class="form-group">
          <label>Jornada</label>
          <select v-model="fichaForm.jornada">
            <option value="Diurna">Diurna</option><option value="Nocturna">Nocturna</option><option value="Mixta">Mixta</option>
          </select>
        </div>
        <div class="form-group"><label>Aula Asignada</label><input v-model="fichaForm.aulaAsignada" type="text" placeholder="Ej: Sala 101 - Edificio B" /></div>
        <div class="form-group">
          <label>Instructor Lider</label>
          <select v-model="fichaForm.instructorLiderId">
            <option :value="null" disabled>Selecciona un instructor</option>
            <option v-for="i in instructoresActivos()" :key="i._id" :value="i._id">{{ i.nombres }} {{ i.apellidos }} — {{ i.especialidad }}</option>
          </select>
        </div>
        <div class="form-group"><label>Fecha de Inicio</label><input v-model="fichaForm.fechaInicio" type="date" /></div>
        <div class="form-group"><label>Fecha de Fin</label><input v-model="fichaForm.fechaFin" type="date" /></div>
      </div>
      <div class="btn-group" style="margin-top: 24px; justify-content: flex-end;">
        <button class="btn btn-outline" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" @click="guardarFicha" :disabled="loading">{{ loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear') + ' Ficha' }}</button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>
