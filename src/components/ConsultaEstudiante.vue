<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api.js'

const busqueda = ref('')
const estudianteSeleccionado = ref(null)
const asistenciasEstudiante = ref([])
const excusasEstudiante = ref([])
const loadingDetalle = ref(false)

const todosEstudiantes = ref([])
const fichasList = ref([])

onMounted(async () => {
  try {
    const [estudiantes, fichas] = await Promise.all([api.estudiantes.getAll(), api.fichas.getAll()])
    todosEstudiantes.value = estudiantes.map(e => {
      const ficha = fichas.find(f => f._id === e.fichaId)
      return { ...e, _ficha: ficha }
    })
    fichasList.value = fichas
  } catch (e) {}
})

const resultados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return []
  return todosEstudiantes.value.filter(e => {
    const nombreCompleto = `${e.nombres} ${e.apellidos}`.toLowerCase()
    return nombreCompleto.includes(q) || e.numeroDocumento.toLowerCase().includes(q)
  }).slice(0, 10)
})

async function seleccionarEstudiante(est) {
  estudianteSeleccionado.value = { ...est }
  loadingDetalle.value = true
  try {
    const [asis, exc] = await Promise.all([
      api.asistencias.getAll({ estudianteId: est._id }),
      api.excusas.getAll({ estudianteId: est._id })
    ])
    asistenciasEstudiante.value = asis
    excusasEstudiante.value = exc
  } catch (e) {
    console.error('Error al cargar reporte de estudiante:', e)
  } finally {
    loadingDetalle.value = false
  }
}

function cerrarPerfil() {
  estudianteSeleccionado.value = null
  busqueda.value = ''
  asistenciasEstudiante.value = []
  excusasEstudiante.value = []
}

function limpiarBusqueda() {
  busqueda.value = ''
  estudianteSeleccionado.value = null
  asistenciasEstudiante.value = []
  excusasEstudiante.value = []
}

const metricasEstudiante = computed(() => {
  let presentes = 0, retardos = 0, fallas = 0
  asistenciasEstudiante.value.forEach(a => {
    if (a.tipo === 'Entrada' || a.tipo === 'Presente') presentes++
    else if (a.tipo === 'Retardo' || a.tipo === 'Tardanza') retardos++
    else if (a.tipo === 'Falla' || a.tipo === 'Ausente') fallas++
  })
  const total = presentes + retardos + fallas
  const pct = total > 0 ? Math.round(((presentes + (retardos * 0.5)) / total) * 100) : 100
  return { presentes, retardos, fallas, total, pct }
})

function imprimirReporteIndividual() {
  window.print()
}

function estadoBadge(estado) {
  if (estado === 'Activo') return 'badge-success'
  if (estado === 'Inactivo') return 'badge-warning'
  return 'badge-danger'
}

function asistenciaBadge(estado) {
  if (estado === 'Presente' || estado === 'Entrada') return 'badge-success'
  if (estado === 'Retardo' || estado === 'Tardanza') return 'badge-warning'
  if (estado === 'Ausente' || estado === 'Falla') return 'badge-danger'
  return 'badge-neutral'
}
</script>

<template>
  <div class="consultor-page">
    <div class="page-header no-print">
      <h1>Panel Consultor de Aprendiz</h1>
      <p>Búsqueda directa por número de documento e historial consolidado de reportes</p>
    </div>

    <!-- Barra de Búsqueda por Documento / Nombres -->
    <div v-if="!estudianteSeleccionado" class="card no-print">
      <div class="consulta-busqueda">
        <svg class="consulta-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="busqueda"
          type="text"
          class="consulta-input"
          placeholder="Ingresa el número de documento o nombre del estudiante..."
          autofocus
        />
        <button v-if="busqueda" class="btn btn-outline btn-sm" @click="limpiarBusqueda">Limpiar</button>
      </div>
    </div>

    <!-- Lista de Resultados Coincidentes -->
    <div v-if="!estudianteSeleccionado && busqueda && resultados.length === 0" class="card no-print">
      <div class="empty-state">
        <p>No se encontró ningún estudiante registrado con el documento o término "{{ busqueda }}".</p>
      </div>
    </div>

    <div v-if="!estudianteSeleccionado && resultados.length > 0" class="resultados-lista no-print">
      <div v-for="e in resultados" :key="e._id" class="resultado-item" @click="seleccionarEstudiante(e)">
        <div class="resultado-avatar">{{ e.nombres.charAt(0) }}{{ e.apellidos.charAt(0) }}</div>
        <div class="resultado-info">
          <strong>{{ e.nombres }} {{ e.apellidos }}</strong>
          <span>Documento: <strong>{{ e.tipoDocumento }} {{ e.numeroDocumento }}</strong></span>
          <span v-if="e._ficha" class="badge badge-ficha">Ficha: {{ e._ficha.codigoFicha }} - {{ e._ficha.nombrePrograma }}</span>
        </div>
        <span class="badge" :class="estadoBadge(e.estado)">{{ e.estado }}</span>
      </div>
    </div>

    <!-- REPORTE INDIVIDUAL DEL APRENDIZ SELECCIONADO -->
    <div v-if="estudianteSeleccionado" class="reporte-individual-container">
      <div class="card card-header-actions no-print" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <button class="btn btn-outline" @click="cerrarPerfil">⬅️ Volver a Búsqueda</button>
          <button class="btn btn-primary" @click="imprimirReporteIndividual">🖨️ Exportar / Imprimir Reporte (PDF)</button>
        </div>
      </div>

      <!-- Encabezado Oficial Imprimible -->
      <div class="printable-report card">
        <div class="report-header-sena">
          <div class="sena-logo-box">
            <h2>SENA</h2>
            <span>Sistema Biométrico de Asistencia</span>
          </div>
          <div class="report-title-box">
            <h3>REPORTE INDIVIDUAL DE ASISTENCIA Y TRAZABILIDAD</h3>
            <p>Generado el: {{ new Date().toLocaleDateString() }} - {{ new Date().toLocaleTimeString() }}</p>
          </div>
        </div>

        <!-- Ficha técnica del Aprendiz -->
        <div class="student-profile-summary">
          <div class="profile-avatar-large">
            {{ estudianteSeleccionado.nombres.charAt(0) }}{{ estudianteSeleccionado.apellidos.charAt(0) }}
          </div>
          <div class="profile-details-grid">
            <div>
              <span class="label">Aprendiz:</span>
              <strong class="value-name">{{ estudianteSeleccionado.nombres }} {{ estudianteSeleccionado.apellidos }}</strong>
            </div>
            <div>
              <span class="label">Documento de Identidad:</span>
              <strong>{{ estudianteSeleccionado.tipoDocumento }} - {{ estudianteSeleccionado.numeroDocumento }}</strong>
            </div>
            <div>
              <span class="label">Correo Electrónico:</span>
              <span>{{ estudianteSeleccionado.correo || '—' }}</span>
            </div>
            <div>
              <span class="label">Teléfono / Contacto:</span>
              <span>{{ estudianteSeleccionado.telefono || '—' }}</span>
            </div>
            <div>
              <span class="label">Ficha de Formación:</span>
              <strong>{{ estudianteSeleccionado._ficha ? `${estudianteSeleccionado._ficha.codigoFicha} - ${estudianteSeleccionado._ficha.nombrePrograma}` : 'Sin Ficha' }}</strong>
            </div>
            <div>
              <span class="label">Jornada y Aula:</span>
              <span>{{ estudianteSeleccionado._ficha ? `${estudianteSeleccionado._ficha.jornada} | ${estudianteSeleccionado._ficha.aulaAsignada}` : '—' }}</span>
            </div>
            <div>
              <span class="label">Registro Biométrico:</span>
              <strong :style="{ color: estudianteSeleccionado.huellaEnrolada ? '#16a34a' : '#d97706' }">
                {{ estudianteSeleccionado.huellaEnrolada ? '🟢 Huella Enrolada' : '🟡 Huella Pendiente' }}
              </strong>
            </div>
            <div>
              <span class="label">Estado en Sistema:</span>
              <span class="badge" :class="estadoBadge(estudianteSeleccionado.estado)">{{ estudianteSeleccionado.estado }}</span>
            </div>
          </div>
        </div>

        <!-- Resumen Estadístico de Asistencia -->
        <div class="report-stats-section">
          <h4>📊 Resumen Estadístico del Aprendiz</h4>
          <div class="stats-row">
            <div class="stat-card stat-activo">
              <span class="stat-num">{{ metricasEstudiante.presentes }}</span>
              <span class="stat-label">Presentes</span>
            </div>
            <div class="stat-card stat-inactivo">
              <span class="stat-num">{{ metricasEstudiante.retardos }}</span>
              <span class="stat-label">Retardos / Tardanzas</span>
            </div>
            <div class="stat-card stat-retirado">
              <span class="stat-num">{{ metricasEstudiante.fallas }}</span>
              <span class="stat-label">Fallas / Inasistencias</span>
            </div>
            <div class="stat-card" style="background: #eff6ff; border-color: #bfdbfe;">
              <span class="stat-num" style="color: #1d4ed8;">{{ metricasEstudiante.pct }}%</span>
              <span class="stat-label">Índice Asistencia</span>
            </div>
          </div>
        </div>

        <!-- Tabla Histórica de Marcas -->
        <div class="report-table-section" style="margin-top: 24px;">
          <h4>📋 Historial Detallado de Registros de Asistencia</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Tipo de Registro</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asis in asistenciasEstudiante" :key="asis._id">
                <td>{{ asis.fecha }}</td>
                <td>{{ asis.hora }}</td>
                <td>
                  <span class="badge" :class="asistenciaBadge(asis.tipo)">{{ asis.tipo }}</span>
                </td>
              </tr>
              <tr v-if="asistenciasEstudiante.length === 0">
                <td colspan="3" class="empty-cell">No se registran marcas de asistencia para este aprendiz.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tabla Histórica de Excusas -->
        <div class="report-table-section" style="margin-top: 24px;">
          <h4>📝 Historial de Excusas Radicadas</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha Inasistencia</th>
                <th>Motivo / Justificación</th>
                <th>Estado de Excusa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exc in excusasEstudiante" :key="exc._id">
                <td>{{ exc.fechaInasistencia }}</td>
                <td>{{ exc.motivo }}</td>
                <td>
                  <span class="badge" :class="exc.estado === 'Aprobada' ? 'badge-success' : (exc.estado === 'Rechazada' ? 'badge-danger' : 'badge-warning')">
                    {{ exc.estado }}
                  </span>
                </td>
              </tr>
              <tr v-if="excusasEstudiante.length === 0">
                <td colspan="3" class="empty-cell">No existen excusas radicadas por el aprendiz.</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.consultor-page {
  padding: 24px;
}

.consulta-busqueda {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card, #ffffff);
  padding: 14px 18px;
  border-radius: 8px;
  border: 1px solid var(--border, #e2e8f0);
}

.consulta-input {
  flex: 1;
  border: none;
  font-size: 16px;
  outline: none;
  background: transparent;
}

.resultados-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.resultado-item {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.resultado-item:hover {
  border-color: #2563eb;
  background: #f8fafc;
}

.resultado-avatar {
  width: 48px;
  height: 48px;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

.resultado-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  font-size: 14px;
}

.printable-report {
  background: #ffffff;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.report-header-sena {
  display: flex;
  justify-content: space-between;
  border-bottom: 2px solid #000000;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.sena-logo-box h2 {
  font-size: 28px;
  font-weight: 800;
  color: #39a900; /* Verde SENA */
  margin: 0;
}

.sena-logo-box span {
  font-size: 12px;
  color: #64748b;
}

.report-title-box h3 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px;
  text-align: right;
}

.report-title-box p {
  font-size: 11px;
  color: #64748b;
  margin: 0;
  text-align: right;
}

.student-profile-summary {
  display: flex;
  gap: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 24px;
}

.profile-avatar-large {
  width: 64px;
  height: 64px;
  background: #39a900;
  color: white;
  font-size: 24px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 24px;
  flex: 1;
  font-size: 13px;
}

.profile-details-grid .label {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}

.value-name {
  font-size: 16px;
  color: #1e293b;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.data-table th, .data-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}

.data-table th {
  background: #f1f5f9;
  font-weight: 600;
}

@media print {
  .no-print {
    display: none !important;
  }
  .printable-report {
    box-shadow: none;
    padding: 0;
  }
}
</style>
