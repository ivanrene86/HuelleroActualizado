<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api.js'
import './panelEstudiante.css'

const userStr = sessionStorage.getItem('user_data')
const usuario = ref(userStr ? JSON.parse(userStr) : { id: '', nombre: 'Estudiante', rol: 'Estudiante' })

const estudiante = ref(null)
const ficha = ref(null)
const instructorLider = ref(null)
const asistencias = ref([])
const excusas = ref([])
const loading = ref(true)
const error = ref('')

const showNuevaExcusaModal = ref(false)
const nuevaExcusa = ref({
  fechaInasistencia: new Date().toISOString().split('T')[0],
  motivo: ''
})

const emit = defineEmits(['cerrar-sesion'])

function cerrarSesion() {
  sessionStorage.removeItem('admin_auth')
  sessionStorage.removeItem('user_data')
  emit('cerrar-sesion')
}

onMounted(async () => {
  await cargarDatosEstudiante()
})

async function cargarDatosEstudiante() {
  loading.value = true
  error.value = ''
  try {
    const estId = usuario.value.id || usuario.value.estudianteId
    const todosEst = await api.estudiantes.getAll()
    estudiante.value = todosEst.find(e => e._id === estId) || todosEst[0]

    if (estudiante.value && estudiante.value.fichaId) {
      const fichas = await api.fichas.getAll()
      ficha.value = fichas.find(f => f._id === estudiante.value.fichaId)
      if (ficha.value && ficha.value.instructorLiderId) {
        instructorLider.value = ficha.value.instructorLiderId
      }

      const asisRes = await api.asistencias.getAll({ estudianteId: estudiante.value._id })
      asistencias.value = asisRes
    }
  } catch (err) {
    error.value = err.message || 'Error al cargar información del aprendiz'
  } finally {
    loading.value = false
  }
}

const resumen = computed(() => {
  let presentes = 0, retardos = 0, fallas = 0
  asistencias.value.forEach(a => {
    if (a.tipo === 'Entrada' || a.tipo === 'Presente') presentes++
    else if (a.tipo === 'Retardo' || a.tipo === 'Tardanza') retardos++
    else if (a.tipo === 'Falla' || a.tipo === 'Ausente') fallas++
  })
  return { presentes, retardos, fallas, total: asistencias.value.length }
})

async function radicarExcusa() {
  if (!nuevaExcusa.value.motivo.trim()) {
    alert('Ingresa el motivo o justificación de la inasistencia')
    return
  }
  try {
    await api.excusas.create({
      estudianteId: estudiante.value._id,
      fichaId: estudiante.value.fichaId,
      fechaInasistencia: nuevaExcusa.value.fechaInasistencia,
      motivo: nuevaExcusa.value.motivo,
      estado: 'Pendiente'
    })
    alert('Excusa radicada correctamente. Será revisada por tu Instructor.')
    showNuevaExcusaModal.value = false
    nuevaExcusa.value.motivo = ''
    await cargarDatosEstudiante()
  } catch (err) {
    alert('Error al radicar excusa: ' + err.message)
  }
}
</script>

<template>
  <div class="student-portal-page">
    <div class="student-portal-header">
      <div>
        <h2>Portal del Aprendiz SENA</h2>
        <p class="student-portal-subtitle">Consulta de Asistencias, Fichas y Excusas</p>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <span class="student-portal-role">Aprendiz</span>
        <button class="student-portal-logout" @click="cerrarSesion">
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>

    <div v-if="loading" class="student-portal-loading">
      Cargando tu perfil e información de asistencia...
    </div>

    <div v-else-if="error" class="student-portal-error">
      {{ error }}
    </div>

    <div v-else class="student-portal-grid">
      <!-- Tarjeta Perfil & Ficha -->
      <div class="student-portal-profile-card">
        <div class="student-portal-avatar">
          {{ estudiante?.nombres?.charAt(0) }}{{ estudiante?.apellidos?.charAt(0) }}
        </div>
        <h3>{{ estudiante?.nombres }} {{ estudiante?.apellidos }}</h3>
        <p class="student-portal-document">{{ estudiante?.tipoDocumento }} {{ estudiante?.numeroDocumento }}</p>

        <div class="student-portal-info-list">
          <div class="student-portal-info-item">
            <span>Ficha:</span>
            <strong>{{ ficha ? `${ficha.codigoFicha} - ${ficha.nombrePrograma}` : 'No asignada' }}</strong>
          </div>
          <div class="student-portal-info-item">
            <span>Jornada:</span>
            <strong>{{ ficha ? ficha.jornada : '—' }}</strong>
          </div>
          <div class="student-portal-info-item">
            <span>Aula:</span>
            <strong>{{ ficha ? ficha.aulaAsignada : '—' }}</strong>
          </div>
          <div class="student-portal-info-item">
            <span>Instructor Líder:</span>
            <strong>{{ instructorLider ? `${instructorLider.nombres} ${instructorLider.apellidos}` : 'No asignado' }}</strong>
          </div>
          <div class="student-portal-info-item">
            <span>Huella Biométrica:</span>
            <strong :style="{ color: estudiante?.huellaEnrolada ? '#16a34a' : '#d97706' }">
              {{ estudiante?.huellaEnrolada ? '🟢 Enrolada' : '🟡 Pendiente de Enrolar' }}
            </strong>
          </div>
        </div>
      </div>

      <!-- Métricas y Registros -->
      <div class="student-portal-main">
        <div class="student-portal-stats">
          <div class="student-portal-stat student-portal-stat-present">
            <span class="student-portal-stat-number">{{ resumen.presentes }}</span>
            <span class="student-portal-stat-label">Presentes</span>
          </div>
          <div class="student-portal-stat student-portal-stat-late">
            <span class="student-portal-stat-number">{{ resumen.retardos }}</span>
            <span class="student-portal-stat-label">Retardos</span>
          </div>
          <div class="student-portal-stat student-portal-stat-absent">
            <span class="student-portal-stat-number">{{ resumen.fallas }}</span>
            <span class="student-portal-stat-label">Fallas / Ausencias</span>
          </div>
        </div>

        <!-- Tabla Historial de Asistencia -->
        <div class="student-portal-card">
          <div class="student-portal-card-header">
            <h3>Mi Historial de Asistencia</h3>
          </div>
          <div class="student-portal-table-container">
            <table class="student-portal-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo / Registro</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asis in asistencias" :key="asis._id">
                  <td>{{ asis.fecha }}</td>
                  <td>{{ asis.hora }}</td>
                  <td>
                    <span class="student-portal-badge" :class="asis.tipo === 'Entrada' || asis.tipo === 'Presente' ? 'student-portal-badge-success' : (asis.tipo === 'Retardo' ? 'student-portal-badge-warning' : 'student-portal-badge-danger')">
                      {{ asis.tipo }}
                    </span>
                  </td>
                </tr>
                <tr v-if="asistencias.length === 0">
                  <td colspan="3" class="student-portal-empty-cell">No tienes marcas de asistencia registradas aún.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

