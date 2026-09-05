<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const showRechazarModal = ref(false)
const rechazarTarget = ref(null)
const rechazarMotivo = ref('')
const filtroEstado = ref('Todos')
const filtroFichaExcusa = ref(null)
const loading = ref(false)

const HORAS_POR_DIA = 6

const excusaForm = reactive({
  estudianteId: null,
  fechaInasistencia: '',
  instructorId: null,
  tipoExcusa: 'Medica',
  motivo: '',
  adjuntoNombre: '',
  adjuntoData: null,
  horasDescontar: HORAS_POR_DIA,
})

const fichasList = ref([])
const todosEstudiantes = ref([])
const todosInstructores = ref([])
const excusas = ref([])

onMounted(async () => {
  await Promise.all([loadExcusas(), loadEstudiantes(), loadFichas(), loadInstructores()])
})

async function loadExcusas() {
  try { excusas.value = await api.excusas.getAll() } catch (e) {}
}

async function loadEstudiantes() {
  try { todosEstudiantes.value = await api.estudiantes.getAll() } catch (e) {}
}

async function loadFichas() {
  try { fichasList.value = await api.fichas.getAll() } catch (e) {}
}

async function loadInstructores() {
  try { todosInstructores.value = await api.instructores.getAll() } catch (e) {}
}

const excusasFiltradas = computed(() => {
  let lista = excusas.value
  if (filtroEstado.value !== 'Todos') lista = lista.filter(e => e.estado === filtroEstado.value)
  if (filtroFichaExcusa.value) {
    lista = lista.filter(e => {
      const fId = e.fichaId?._id || e.fichaId
      return String(fId) === String(filtroFichaExcusa.value)
    })
  }
  return lista.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

function getEstudiante(e) {
  if (e.estudianteId && typeof e.estudianteId === 'object') return e.estudianteId
  return todosEstudiantes.value.find(est => est._id === e.estudianteId) || {}
}

function getFicha(e) {
  if (e.fichaId && typeof e.fichaId === 'object') return e.fichaId
  return fichasList.value.find(f => f._id === e.fichaId) || {}
}

function getInstructor(e) {
  if (e.instructorId && typeof e.instructorId === 'object') {
    return {
      nombre: `${e.instructorId.nombres || ''} ${e.instructorId.apellidos || ''}`.trim() || 'Docente de Clase',
      especialidad: e.instructorId.especialidad || 'Formación Técnica'
    }
  }
  const inst = todosInstructores.value.find(i => String(i._id) === String(e.instructorId))
  if (inst) {
    return {
      nombre: `${inst.nombres} ${inst.apellidos}`,
      especialidad: inst.especialidad || 'Formación Técnica'
    }
  }
  return { nombre: 'Docente de Clase', especialidad: 'Formación Técnica' }
}

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function openCreate() {
  Object.assign(excusaForm, {
    estudianteId: null,
    fechaInasistencia: new Date().toISOString().slice(0, 10),
    instructorId: null,
    tipoExcusa: 'Medica',
    motivo: '',
    adjuntoNombre: '',
    adjuntoData: null,
    horasDescontar: HORAS_POR_DIA,
  })
  showModal.value = true
}

function closeModal() { showModal.value = false }

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  excusaForm.adjuntoNombre = file.name
  if (file.size > 2 * 1024 * 1024) {
    excusaForm.adjuntoData = null
    excusaForm.adjuntoNombre += ' (archivo grande - solo referencia)'
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => { excusaForm.adjuntoData = e.target.result }
  reader.readAsDataURL(file)
}

async function guardarExcusa() {
  if (!excusaForm.estudianteId || !excusaForm.fechaInasistencia || !excusaForm.motivo.trim()) {
    showToastFn('Completa el estudiante, fecha y motivo de la excusa', 'error')
    return
  }
  loading.value = true
  try {
    const est = todosEstudiantes.value.find(e => e._id === excusaForm.estudianteId)
    await api.excusas.create({
      estudianteId: excusaForm.estudianteId,
      fichaId: est ? est.fichaId : null,
      instructorId: excusaForm.instructorId,
      fechaInasistencia: excusaForm.fechaInasistencia,
      tipoExcusa: excusaForm.tipoExcusa,
      motivo: excusaForm.motivo,
      adjuntoNombre: excusaForm.adjuntoNombre,
      adjuntoData: excusaForm.adjuntoData,
      horasDescontar: excusaForm.horasDescontar,
    })
    await loadExcusas()
    closeModal()
    showToastFn('Excusa registrada correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function aprobarExcusa(excusa) {
  try {
    await api.excusas.aprobar(excusa._id)
    await loadExcusas()
    showToastFn(`Excusa aprobada. ${excusa.horasDescontar || 6} horas descontadas del contador de fallas.`)
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function abrirRechazar(excusa) {
  rechazarTarget.value = excusa
  rechazarMotivo.value = ''
  showRechazarModal.value = true
}

function closeRechazar() {
  showRechazarModal.value = false
  rechazarTarget.value = null
  rechazarMotivo.value = ''
}

async function confirmarRechazar() {
  if (!rechazarTarget.value) return
  try {
    await api.excusas.rechazar(rechazarTarget.value._id, rechazarMotivo.value)
    await loadExcusas()
    closeRechazar()
    showToastFn('Excusa rechazada')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function tipoBadge(tipo) {
  const map = { Medica: 'badge-info', Personal: 'badge-warning', Institucional: 'badge-success' }
  return map[tipo] || 'badge-default'
}

function estadoBadge(estado) {
  const map = { Pendiente: 'badge-warning', Aprobada: 'badge-success', Rechazada: 'badge-danger' }
  return map[estado] || 'badge-default'
}
</script>

<template>
  <div class="page-header">
    <h1>Gestión de Excusas e Inasistencias</h1>
    <p>Revisión y aprobación de justificaciones médicas e institucionales con atribución por docente y horas</p>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>

  <div class="card">
    <div class="card-header">
      <div class="card-header-left">
        <h3>Listado de Excusas Radicadas</h3>
        <select v-model="filtroEstado" class="filtro-select">
          <option value="Todos">Todas los estados</option>
          <option value="Pendiente">Pendientes</option>
          <option value="Aprobada">Aprobadas</option>
          <option value="Rechazada">Rechazadas</option>
        </select>
        <select v-model="filtroFichaExcusa" class="filtro-select">
          <option :value="null">Todas las fichas</option>
          <option v-for="f in fichasList" :key="f._id" :value="f._id">{{ f.codigoFicha }} - {{ f.nombrePrograma }}</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ Radicar Excusa Manual</button>
    </div>

    <div v-if="excusasFiltradas.length === 0" class="empty-state">
      <p>No hay excusas registradas para el filtro seleccionado.</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Aprendiz</th>
            <th>Ficha</th>
            <th>Fecha Inasistencia</th>
            <th>Profesor de la Clase</th>
            <th>Tipo / Justificación</th>
            <th>Horas</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in excusasFiltradas" :key="e._id" :class="{ 'fila-inactivo': e.estado === 'Rechazada' }">
            <td>
              <strong>{{ getEstudiante(e).nombres }} {{ getEstudiante(e).apellidos }}</strong>
              <div style="font-size: 11px; color: var(--text-secondary);">{{ getEstudiante(e).tipoDocumento }} {{ getEstudiante(e).numeroDocumento }}</div>
            </td>
            <td>
              <span class="badge badge-ficha">{{ getFicha(e).codigoFicha || '—' }}</span>
              <div style="font-size: 11px; color: var(--text-secondary);">{{ getFicha(e).jornada }}</div>
            </td>
            <td><strong>{{ e.fechaInasistencia }}</strong></td>
            <td>
              <strong>👨‍🏫 {{ getInstructor(e).nombre }}</strong>
              <div style="font-size: 11px; color: var(--text-secondary);">{{ getInstructor(e).especialidad }}</div>
            </td>
            <td>
              <span class="badge" :class="tipoBadge(e.tipoExcusa)">{{ e.tipoExcusa }}</span>
              <div style="font-size: 12px; color: #334155; margin-top: 4px; max-width: 250px;">
                {{ e.motivo }}
              </div>
              <div v-if="e.adjuntoNombre" style="font-size: 11px; color: #0284c7; margin-top: 2px;">
                📎 {{ e.adjuntoNombre }}
              </div>
            </td>
            <td><strong>{{ e.horasDescontar || 6 }}h</strong></td>
            <td>
              <span class="badge" :class="estadoBadge(e.estado)">{{ e.estado }}</span>
              <div v-if="e.estado === 'Rechazada' && e.motivoRechazo" class="motivo-texto" style="color: #dc2626; font-size: 11px; margin-top: 4px;">
                Motivo: {{ e.motivoRechazo }}
              </div>
            </td>
            <td>
              <div class="btn-group">
                <template v-if="e.estado === 'Pendiente'">
                  <button class="btn btn-success btn-sm" @click="aprobarExcusa(e)">Aprobar</button>
                  <button class="btn btn-danger btn-sm" @click="abrirRechazar(e)">Rechazar</button>
                </template>
                <span v-else style="font-size: 12px; color: var(--text-secondary);">
                  {{ e.updatedAt ? new Date(e.updatedAt).toLocaleDateString('es-CO') : 'Procesada' }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL REGISTRAR EXCUSA MANUAL -->
  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal" style="max-width: 550px;">
      <h2>Radicar Justificación de Excusa</h2>
      <div class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Aprendiz <span style="color: #ef4444;">*</span></label>
          <select v-model="excusaForm.estudianteId">
            <option :value="null" disabled>Selecciona un aprendiz</option>
            <option v-for="e in todosEstudiantes" :key="e._id" :value="e._id">
              {{ e.nombres }} {{ e.apellidos }} — {{ e.tipoDocumento }} {{ e.numeroDocumento }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Fecha de Inasistencia <span style="color: #ef4444;">*</span></label>
          <input v-model="excusaForm.fechaInasistencia" type="date" />
        </div>

        <div class="form-group">
          <label>Profesor de la Clase</label>
          <select v-model="excusaForm.instructorId">
            <option :value="null">Detección automática por horario</option>
            <option v-for="inst in todosInstructores" :key="inst._id" :value="inst._id">
              {{ inst.nombres }} {{ inst.apellidos }} ({{ inst.especialidad || 'Docente' }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Tipo de Excusa</label>
          <select v-model="excusaForm.tipoExcusa">
            <option value="Medica">Médica (EPS / Hospital)</option>
            <option value="Personal">Personal / Calamidad Doméstica</option>
            <option value="Institucional">Institucional SENA / Pasantía</option>
          </select>
        </div>

        <div class="form-group">
          <label>Horas a Descontar</label>
          <input v-model.number="excusaForm.horasDescontar" type="number" min="1" max="24" />
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Motivo o Justificación Detallada <span style="color: #ef4444;">*</span></label>
          <textarea
            v-model="excusaForm.motivo"
            rows="3"
            placeholder="Escribe el motivo detallado de la inasistencia..."
            style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px;"
          ></textarea>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Documento de Soporte (Opcional)</label>
          <div class="file-upload-wrapper">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="handleFileUpload" class="file-input" />
            <span v-if="excusaForm.adjuntoNombre" class="file-name">{{ excusaForm.adjuntoNombre }}</span>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" :disabled="loading" @click="guardarExcusa">Guardar Excusa</button>
      </div>
    </div>
  </div>

  <!-- MODAL RECHAZAR EXCUSA -->
  <div v-if="showRechazarModal" class="modal-overlay" @click.self="closeRechazar">
    <div class="modal" style="max-width: 440px;">
      <h2>Rechazar Excusa</h2>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">
        Indica el motivo por el cual no se acepta la justificación (ej. soporte ilegible o fuera del plazo reglamentario):
      </p>
      <div class="form-group">
        <textarea
          v-model="rechazarMotivo"
          placeholder="Motivo del rechazo..."
          rows="3"
          style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px;"
        ></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="closeRechazar">Cancelar</button>
        <button class="btn btn-danger" @click="confirmarRechazar">Confirmar Rechazo</button>
      </div>
    </div>
  </div>
</template>
