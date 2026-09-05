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
const instructoresList = ref([])
const loading = ref(true)
const error = ref('')
const filtroInasistencias = ref('todas') // 'todas', 'presenciales', 'sin_excusa', 'con_excusa', 'desescolarizados'

const showNuevaExcusaModal = ref(false)
const nuevaExcusa = ref({
  fechaInasistencia: new Date().toISOString().split('T')[0],
  instructorNombre: '',
  instructorId: null,
  horas: 6,
  motivo: ''
})

const emit = defineEmits(['cerrar-sesion'])

function cerrarSesion() {
  sessionStorage.removeItem('admin_auth')
  sessionStorage.removeItem('user_data')
  sessionStorage.removeItem('auth_token')
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
    const [todosEst, instRes] = await Promise.all([
      api.estudiantes.getAll(),
      api.instructores.getAll().catch(() => [])
    ])
    instructoresList.value = instRes
    estudiante.value = todosEst.find(e => e._id === estId) || todosEst[0]

    if (estudiante.value && estudiante.value.fichaId) {
      const fichas = await api.fichas.getAll()
      ficha.value = fichas.find(f => f._id === estudiante.value.fichaId)
      if (ficha.value && ficha.value.instructorLiderId) {
        instructorLider.value = ficha.value.instructorLiderId
      }

      const [asisRes, excusasRes] = await Promise.all([
        api.asistencias.getAll({ estudianteId: estudiante.value._id }),
        api.excusas.getAll({ estudianteId: estudiante.value._id }).catch(() => [])
      ])
      asistencias.value = asisRes
      excusas.value = excusasRes
    }
  } catch (err) {
    error.value = err.message || 'Error al cargar información del aprendiz'
  } finally {
    loading.value = false
  }
}

const horasPorJornada = computed(() => {
  const j = (ficha.value?.jornada || '').toLowerCase()
  if (j.includes('noche') || j.includes('nocturna')) return 4
  return 6
})

function getInstructorData(asis) {
  if (!asis || !asis.instructorId) return { nombre: 'Docente Asignado', especialidad: 'Formación Técnica' }
  if (typeof asis.instructorId === 'object') {
    return {
      nombre: `${asis.instructorId.nombres || ''} ${asis.instructorId.apellidos || ''}`.trim() || 'Docente Asignado',
      especialidad: asis.instructorId.especialidad || 'Formación Técnica',
      id: asis.instructorId._id
    }
  }
  const inst = instructoresList.value.find(i => String(i._id) === String(asis.instructorId))
  if (inst) {
    return {
      nombre: `${inst.nombres} ${inst.apellidos}`,
      especialidad: inst.especialidad || 'Formación Técnica',
      id: inst._id
    }
  }
  return { nombre: 'Docente Asignado', especialidad: 'Formación Técnica' }
}

const resumen = computed(() => {
  let presentes = 0, tardanzas = 0, fallasSinExcusa = 0, fallasConExcusa = 0, diasDesescolarizados = 0
  const hDia = horasPorJornada.value

  asistencias.value.forEach(a => {
    const est = a.estado || a.tipo
    if (est === 'Presente' || est === 'Entrada') presentes++
    else if (est === 'Tardanza' || est === 'Retardo') tardanzas++
    else if (est === 'Excusada') fallasConExcusa++
    else if (est === 'Inhabilitada') diasDesescolarizados++
    else if (est === 'Falta' || est === 'Ausente') fallasSinExcusa++
  })

  const horasSinExcusa = fallasSinExcusa * hDia
  const horasConExcusa = fallasConExcusa * hDia
  const totalHorasFalladas = horasSinExcusa + horasConExcusa
  const totalClasesPresenciales = presentes + tardanzas + fallasSinExcusa + fallasConExcusa
  const porcentaje = totalClasesPresenciales > 0
    ? Math.round(((presentes + (tardanzas * 0.5)) / totalClasesPresenciales) * 100)
    : 100

  return {
    presentes,
    tardanzas,
    fallasSinExcusa,
    fallasConExcusa,
    diasDesescolarizados,
    horasSinExcusa,
    horasConExcusa,
    totalHorasFalladas,
    totalClasesPresenciales,
    porcentaje,
    total: asistencias.value.length
  }
})

const asistenciasFiltradas = computed(() => {
  if (filtroInasistencias.value === 'presenciales') {
    // Solo clases reales presenciales (excluye días desescolarizados)
    return asistencias.value.filter(a => a.estado !== 'Inhabilitada')
  }
  if (filtroInasistencias.value === 'sin_excusa') {
    return asistencias.value.filter(a => a.estado === 'Falta' || a.estado === 'Ausente')
  }
  if (filtroInasistencias.value === 'con_excusa') {
    return asistencias.value.filter(a => a.estado === 'Excusada')
  }
  if (filtroInasistencias.value === 'desescolarizados') {
    return asistencias.value.filter(a => a.estado === 'Inhabilitada')
  }
  return asistencias.value
})

function abrirModalExcusa(asis) {
  const instData = getInstructorData(asis)
  nuevaExcusa.value = {
    fechaInasistencia: asis.fecha,
    instructorNombre: instData.nombre,
    instructorId: instData.id || null,
    horas: horasPorJornada.value,
    motivo: ''
  }
  showNuevaExcusaModal.value = true
}

async function radicarExcusa() {
  if (!nuevaExcusa.value.motivo.trim()) {
    alert('Ingresa el motivo o justificación de la inasistencia')
    return
  }
  try {
    await api.excusas.create({
      estudianteId: estudiante.value._id,
      fichaId: estudiante.value.fichaId,
      instructorId: nuevaExcusa.value.instructorId,
      fechaInasistencia: nuevaExcusa.value.fechaInasistencia,
      motivo: nuevaExcusa.value.motivo,
      horasDescontar: nuevaExcusa.value.horas,
      estado: 'Pendiente'
    })
    alert('✅ Excusa radicada correctamente. Ha sido enviada para revisión del Instructor.')
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
        <p class="student-portal-subtitle">Consulta de Asistencias, Inasistencias por Docente y Radicación de Excusas</p>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <span class="student-portal-role">Aprendiz</span>
        <button class="student-portal-logout" @click="cerrarSesion">
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>

    <div v-if="loading" class="student-portal-loading">
      Cargando tu perfil e historial de formación...
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
            <strong>{{ ficha ? `${ficha.jornada} (${horasPorJornada}h/día)` : '—' }}</strong>
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
        <!-- MÉTRICAS DE HORAS E INASISTENCIAS -->
        <div class="student-portal-stats" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
          <div class="student-portal-stat student-portal-stat-present">
            <span class="student-portal-stat-number">{{ resumen.presentes }}</span>
            <span class="student-portal-stat-label">Presentes</span>
          </div>
          <div class="student-portal-stat student-portal-stat-late">
            <span class="student-portal-stat-number">{{ resumen.tardanzas }}</span>
            <span class="student-portal-stat-label">Tardanzas</span>
          </div>
          <div class="student-portal-stat" style="border-left: 4px solid #6366f1; background: #f8fafc; padding: 12px; border-radius: 8px;">
            <span class="student-portal-stat-number" style="color: #4f46e5;">{{ resumen.totalHorasFalladas }}h</span>
            <span class="student-portal-stat-label" style="font-size: 11px; font-weight: 700;">Total Horas Ausente</span>
          </div>
          <div class="student-portal-stat student-portal-stat-absent" style="border-left: 4px solid #ef4444;">
            <span class="student-portal-stat-number" style="color: #dc2626;">{{ resumen.horasSinExcusa }}h</span>
            <span class="student-portal-stat-label" style="font-size: 11px; font-weight: 700;">❌ Sin Excusa</span>
          </div>
          <div class="student-portal-stat" style="border-left: 4px solid #0284c7; background: #f0f9ff; padding: 12px; border-radius: 8px;">
            <span class="student-portal-stat-number" style="color: #0284c7;">{{ resumen.horasConExcusa }}h</span>
            <span class="student-portal-stat-label" style="font-size: 11px; font-weight: 700;">📋 Con Excusa</span>
          </div>
          <div class="student-portal-stat" style="border-left: 4px solid #64748b; background: #f1f5f9; padding: 12px; border-radius: 8px;">
            <span class="student-portal-stat-number" style="color: #475569;">{{ resumen.diasDesescolarizados }}</span>
            <span class="student-portal-stat-label" style="font-size: 11px; font-weight: 700;">📅 Desescolarizados (0h)</span>
          </div>
        </div>

        <!-- FILTROS INTELIGENTES DE HISTORIAL -->
        <div style="margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap;">
          <button
            class="btn btn-sm"
            :class="filtroInasistencias === 'todas' ? 'btn-primary' : 'btn-outline'"
            @click="filtroInasistencias = 'todas'"
          >
            📊 Todo el Historial ({{ asistencias.length }})
          </button>
          <button
            class="btn btn-sm"
            :class="filtroInasistencias === 'presenciales' ? 'btn-primary' : 'btn-outline'"
            @click="filtroInasistencias = 'presenciales'"
          >
            ⏱️ Solo Clases Presenciales (Fue / Falta)
          </button>
          <button
            class="btn btn-sm"
            :class="filtroInasistencias === 'sin_excusa' ? 'btn-danger' : 'btn-outline'"
            @click="filtroInasistencias = 'sin_excusa'"
          >
            ❌ Solo Sin Excusa ({{ resumen.fallasSinExcusa }})
          </button>
          <button
            class="btn btn-sm"
            :class="filtroInasistencias === 'con_excusa' ? 'btn-info' : 'btn-outline'"
            @click="filtroInasistencias = 'con_excusa'"
          >
            📋 Solo Con Excusa ({{ resumen.fallasConExcusa }})
          </button>
          <button
            class="btn btn-sm"
            :class="filtroInasistencias === 'desescolarizados' ? 'btn-secondary' : 'btn-outline'"
            @click="filtroInasistencias = 'desescolarizados'"
          >
            📅 Días Desescolarizados ({{ resumen.diasDesescolarizados }})
          </button>
        </div>

        <!-- Tabla Historial de Asistencia Detallada -->
        <div class="student-portal-card">
          <div class="student-portal-card-header">
            <h3>Historial de Asistencia y Detalle por Profesor</h3>
          </div>
          <div class="student-portal-table-container">
            <table class="student-portal-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Profesor / Clase</th>
                  <th>Estado</th>
                  <th>Horas</th>
                  <th>Motivo / Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asis in asistenciasFiltradas" :key="asis._id">
                  <td><strong>{{ asis.fecha }}</strong></td>
                  <td>{{ asis.hora || '—' }}</td>
                  <td>
                    <!-- DOCENTE A CARGO -->
                    <div v-if="asis.estado !== 'Inhabilitada'">
                      <strong>👨‍🏫 {{ getInstructorData(asis).nombre }}</strong>
                      <div style="font-size: 11px; color: #64748b;">{{ getInstructorData(asis).especialidad }}</div>
                    </div>
                    <div v-else style="color: #64748b; font-size: 12px;">
                      🏫 Institucional SENA
                    </div>
                  </td>
                  <td>
                    <span
                      v-if="asis.estado === 'Presente' || asis.tipo === 'Presente'"
                      class="student-portal-badge student-portal-badge-success"
                    >
                      Presente
                    </span>
                    <span
                      v-else-if="asis.estado === 'Tardanza' || asis.tipo === 'Tardanza'"
                      class="student-portal-badge student-portal-badge-warning"
                    >
                      Tardanza
                    </span>
                    <span
                      v-else-if="asis.estado === 'Excusada'"
                      class="student-portal-badge"
                      style="background: #e0f2fe; color: #0369a1; font-weight: 700;"
                    >
                      📋 Excusada
                    </span>
                    <span
                      v-else-if="asis.estado === 'Inhabilitada'"
                      class="student-portal-badge"
                      style="background: #f1f5f9; color: #475569; font-weight: 600; border: 1px solid #cbd5e1;"
                    >
                      📅 Desescolarizada
                    </span>
                    <span
                      v-else
                      class="student-portal-badge student-portal-badge-danger"
                    >
                      ❌ Injustificada
                    </span>
                  </td>
                  <td>
                    <strong v-if="asis.estado === 'Falta' || asis.estado === 'Ausente'" style="color: #dc2626;">
                      {{ horasPorJornada }} hrs
                    </strong>
                    <span v-else-if="asis.estado === 'Excusada'" style="color: #0284c7; font-weight: 600;">
                      {{ horasPorJornada }} hrs
                    </span>
                    <span v-else-if="asis.estado === 'Inhabilitada'" style="color: #64748b;">
                      0 hrs
                    </span>
                    <span v-else style="color: #16a34a; font-weight: 600;">
                      Asistió
                    </span>
                  </td>
                  <td>
                    <!-- MOTIVO O ACCIÓN DE RADICAR -->
                    <div v-if="asis.estado === 'Inhabilitada'" style="font-size: 12px; color: #64748b;">
                      {{ asis.motivoInhabilitacion || 'Jornada no lectiva autorizada' }}
                    </div>
                    <div v-else-if="asis.estado === 'Excusada'" style="font-size: 12px; color: #0369a1;">
                      {{ asis.motivoInhabilitacion || asis.motivo || 'Justificada' }}
                    </div>
                    <div v-else-if="asis.estado === 'Falta' || asis.estado === 'Ausente'">
                      <button class="btn btn-sm btn-outline" style="font-size: 11px; padding: 3px 8px;" @click="abrirModalExcusa(asis)">
                        📝 Radicar Excusa
                      </button>
                    </div>
                    <span v-else style="color: #94a3b8; font-size: 12px;">—</span>
                  </td>
                </tr>
                <tr v-if="asistenciasFiltradas.length === 0">
                  <td colspan="6" class="student-portal-empty-cell">
                    No se encontraron registros para el filtro seleccionado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- SECCIÓN: MIS EXCUSAS RADICADAS -->
        <div v-if="excusas.length > 0" class="student-portal-card" style="margin-top: 24px;">
          <div class="student-portal-card-header">
            <h3>Mis Excusas Radicadas</h3>
          </div>
          <div class="student-portal-table-container">
            <table class="student-portal-table">
              <thead>
                <tr>
                  <th>Fecha Falta</th>
                  <th>Profesor / Clase</th>
                  <th>Horas</th>
                  <th>Motivo Radicado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="exc in excusas" :key="exc._id">
                  <td><strong>{{ exc.fechaInasistencia }}</strong></td>
                  <td>
                    <span v-if="exc.instructorId">
                      👨‍🏫 {{ exc.instructorId.nombres }} {{ exc.instructorId.apellidos }}
                    </span>
                    <span v-else style="color: #94a3b8;">Docente Asignado</span>
                  </td>
                  <td>{{ exc.horasDescontar || horasPorJornada }} hrs</td>
                  <td>{{ exc.motivo }}</td>
                  <td>
                    <span
                      v-if="exc.estado === 'Aprobada'"
                      class="student-portal-badge student-portal-badge-success"
                    >
                      ✓ Aprobada
                    </span>
                    <span
                      v-else-if="exc.estado === 'Rechazada'"
                      class="student-portal-badge student-portal-badge-danger"
                    >
                      ✕ Rechazada
                    </span>
                    <span
                      v-else
                      class="student-portal-badge student-portal-badge-warning"
                    >
                      ⏳ Pendiente
                    </span>
                    <div v-if="exc.motivoRechazo" style="font-size: 11px; color: #dc2626; margin-top: 4px;">
                      Motivo: {{ exc.motivoRechazo }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <!-- MODAL PARA RADICAR EXCUSA CON DETALLE DE PROFESOR -->
    <div v-if="showNuevaExcusaModal" class="modal-overlay" @click.self="showNuevaExcusaModal = false">
      <div class="modal" style="max-width: 500px; padding: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 20px;">📝 Radicar Justificación de Inasistencia</h3>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 18px;">
          Tu excusa será enviada para aprobación del Instructor Líder de la ficha.
        </p>

        <div style="background: #f8fafc; border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>📅 Fecha de la Falta:</strong> {{ nuevaExcusa.fechaInasistencia }}
          </div>
          <div style="font-size: 13px; margin-bottom: 6px;">
            <strong>👨‍🏫 Profesor a Cargo:</strong> {{ nuevaExcusa.instructorNombre }}
          </div>
          <div style="font-size: 13px;">
            <strong>⏱️ Tiempo a Justificar:</strong> {{ nuevaExcusa.horas }} horas
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 18px;">
          <label style="display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px;">
            Motivo de la Inasistencia <span style="color: #ef4444;">*</span>
          </label>
          <textarea
            v-model="nuevaExcusa.motivo"
            rows="3"
            placeholder="Describe la razón: cita médica EPS, incapacidad, calamidad doméstica, etc."
            style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px;"
          ></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-outline" @click="showNuevaExcusaModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="radicarExcusa">Enviar Justificación</button>
        </div>
      </div>
    </div>
  </div>
</template>
