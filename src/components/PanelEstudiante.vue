<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api.js'

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

      const [asisRes, excRes] = await Promise.all([
        api.asistencias.getAll({ estudianteId: estudiante.value._id }),
        api.excusas.getAll({ estudianteId: estudiante.value._id })
      ])
      asistencias.value = asisRes
      excusas.value = excRes
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
  <div class="panel-estudiante">
    <div class="estudiante-header">
      <div>
        <h2>Portal del Aprendiz SENA</h2>
        <p class="subtitle">Consulta de Asistencias, Fichas y Excusas</p>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <span class="role-pill">Aprendiz</span>
        <button class="btn-logout-panel" @click="cerrarSesion">
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-box">
      Cargando tu perfil e información de asistencia...
    </div>

    <div v-else-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-else class="estudiante-grid">
      <!-- Tarjeta Perfil & Ficha -->
      <div class="card-perfil">
        <div class="avatar-big">
          {{ estudiante?.nombres?.charAt(0) }}{{ estudiante?.apellidos?.charAt(0) }}
        </div>
        <h3>{{ estudiante?.nombres }} {{ estudiante?.apellidos }}</h3>
        <p class="doc-text">{{ estudiante?.tipoDocumento }} {{ estudiante?.numeroDocumento }}</p>

        <div class="info-list">
          <div class="info-item">
            <span>Ficha:</span>
            <strong>{{ ficha ? `${ficha.codigoFicha} - ${ficha.nombrePrograma}` : 'No asignada' }}</strong>
          </div>
          <div class="info-item">
            <span>Jornada:</span>
            <strong>{{ ficha ? ficha.jornada : '—' }}</strong>
          </div>
          <div class="info-item">
            <span>Aula:</span>
            <strong>{{ ficha ? ficha.aulaAsignada : '—' }}</strong>
          </div>
          <div class="info-item">
            <span>Instructor Líder:</span>
            <strong>{{ instructorLider ? `${instructorLider.nombres} ${instructorLider.apellidos}` : 'No asignado' }}</strong>
          </div>
          <div class="info-item">
            <span>Huella Biométrica:</span>
            <strong :style="{ color: estudiante?.huellaEnrolada ? '#16a34a' : '#d97706' }">
              {{ estudiante?.huellaEnrolada ? '🟢 Enrolada' : '🟡 Pendiente de Enrolar' }}
            </strong>
          </div>
        </div>
      </div>

      <!-- Métricas y Registros -->
      <div class="estudiante-main">
        <div class="stats-row">
          <div class="stat-card stat-activo">
            <span class="stat-num">{{ resumen.presentes }}</span>
            <span class="stat-label">Presentes</span>
          </div>
          <div class="stat-card stat-inactivo">
            <span class="stat-num">{{ resumen.retardos }}</span>
            <span class="stat-label">Retardos</span>
          </div>
          <div class="stat-card stat-retirado">
            <span class="stat-num">{{ resumen.fallas }}</span>
            <span class="stat-label">Fallas / Ausencias</span>
          </div>
        </div>

        <!-- Tabla Historial de Asistencia -->
        <div class="card">
          <div class="card-header">
            <h3>Mi Historial de Asistencia</h3>
          </div>
          <div class="table-container">
            <table>
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
                    <span class="badge" :class="asis.tipo === 'Entrada' || asis.tipo === 'Presente' ? 'badge-success' : (asis.tipo === 'Retardo' ? 'badge-warning' : 'badge-danger')">
                      {{ asis.tipo }}
                    </span>
                  </td>
                </tr>
                <tr v-if="asistencias.length === 0">
                  <td colspan="3" class="empty-state">No tienes marcas de asistencia registradas aún.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-estudiante {
  padding: 24px;
}

.estudiante-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.subtitle {
  color: #64748b;
  font-size: 14px;
}

.role-pill {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
}

.btn-logout-panel {
  background: #ef4444;
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.estudiante-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

.card-perfil {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: center;
}

.avatar-big {
  width: 72px;
  height: 72px;
  background: #2563eb;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 auto 16px;
}

.doc-text {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 20px;
}

.info-list {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 8px;
}

.info-item span {
  color: #64748b;
  font-size: 12px;
}

.btn-block {
  width: 100%;
}
</style>
