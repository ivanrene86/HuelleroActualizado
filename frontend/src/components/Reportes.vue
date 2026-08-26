<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api.js'

const filtroFicha = ref(null)
const fechaDesde = ref('')
const fechaHasta = ref('')
const formato = ref('pdf')
const showPreview = ref(false)
const filtroTipoInasistencia = ref('todas') // 'todas', 'sin_excusa', 'con_excusa'

const fichasList = ref([])
const todosEstudiantes = ref([])
const todasAsistencias = ref([])

const userStr = sessionStorage.getItem('user_data')
const usuario = ref(userStr ? JSON.parse(userStr) : { id: '', rol: 'Administrador' })

const fichasLideradas = computed(() => {
  if (usuario.value.rol === 'Administrador') {
    return fichasList.value
  }
  // Para instructor: solo las fichas que lidera
  return fichasList.value.filter(f => {
    const liderId = f.instructorLiderId?._id || f.instructorLiderId
    return String(liderId) === String(usuario.value.id)
  })
})

onMounted(async () => {
  try {
    fichasList.value = await api.fichas.getAll()
    const [estRes, asisRes] = await Promise.all([
      api.estudiantes.getAll(),
      api.asistencias.getAll()
    ])
    todosEstudiantes.value = estRes
    todasAsistencias.value = asisRes
  } catch (e) {}
})

const fichaSeleccionada = computed(() => fichasList.value.find(f => f._id === filtroFicha.value))

const horasPorJornada = computed(() => {
  const j = (fichaSeleccionada.value?.jornada || '').toLowerCase()
  if (j.includes('noche') || j.includes('nocturna')) return 4
  return 6 // Mañana, Tarde o Mixta estándar 6 horas
})

const estudiantesFicha = computed(() => {
  if (!filtroFicha.value) return []
  return todosEstudiantes.value.filter(e => e.fichaId === filtroFicha.value)
})

const fechasUnicas = computed(() => {
  const asistencias = todasAsistencias.value.filter(a => a.fichaId === filtroFicha.value)
  let fechas = [...new Set(asistencias.map(a => a.fecha))]
  if (fechaDesde.value) fechas = fechas.filter(f => f >= fechaDesde.value)
  if (fechaHasta.value) fechas = fechas.filter(f => f <= fechaHasta.value)
  return fechas.sort()
})

const datosReporte = computed(() => {
  const hDia = horasPorJornada.value
  return estudiantesFicha.value.map(est => {
    let presentes = 0, tardanzas = 0, fallasSinExcusa = 0, fallasConExcusa = 0
    let horasTardanza = 0
    const motivos = []

    fechasUnicas.value.forEach(fecha => {
      const reg = todasAsistencias.value.find(a => a.estudianteId === est._id && a.fecha === fecha && a.fichaId === filtroFicha.value)
      if (reg) {
        if (reg.estado === 'Presente') {
          presentes++
        } else if (reg.estado === 'Tardanza') {
          tardanzas++
          horasTardanza += Number(reg.horasTardanza) || 0
        } else if (reg.estado === 'Excusada') {
          fallasConExcusa++
          if (reg.motivo || reg.motivoInhabilitacion) {
            motivos.push(`${fecha}: ${reg.motivo || reg.motivoInhabilitacion}`)
          }
        } else if (reg.estado === 'Falta' || reg.estado === 'Ausente') {
          fallasSinExcusa++
        }
      }
    })

    const totalDias = presentes + tardanzas + fallasSinExcusa + fallasConExcusa
    const porcentaje = totalDias > 0 ? Math.round(((presentes + (tardanzas * 0.5)) / totalDias) * 100) : 0

    const horasSinExcusa = fallasSinExcusa * hDia
    const horasConExcusa = fallasConExcusa * hDia
    const horasTotalesFalladas = horasSinExcusa + horasConExcusa

    return {
      estudiante: est,
      presentes,
      tardanzas,
      horasTardanza,
      fallasSinExcusa,
      fallasConExcusa,
      horasSinExcusa,
      horasConExcusa,
      horasTotalesFalladas,
      motivos,
      totalDias,
      porcentaje
    }
  })
})

const datosReporteFiltrados = computed(() => {
  if (filtroTipoInasistencia.value === 'sin_excusa') {
    return datosReporte.value.filter(r => r.horasSinExcusa > 0)
  }
  if (filtroTipoInasistencia.value === 'con_excusa') {
    return datosReporte.value.filter(r => r.horasConExcusa > 0)
  }
  return datosReporte.value
})

const resumenReporte = computed(() => {
  const d = datosReporte.value
  return {
    totalEstudiantes: d.length,
    totalPresentes: d.reduce((s, r) => s + r.presentes, 0),
    totalTardanzas: d.reduce((s, r) => s + r.tardanzas, 0),
    totalHorasSinExcusa: d.reduce((s, r) => s + r.horasSinExcusa, 0),
    totalHorasConExcusa: d.reduce((s, r) => s + r.horasConExcusa, 0),
    totalHorasFalladas: d.reduce((s, r) => s + r.horasTotalesFalladas, 0),
    porcentajeGeneral: d.length > 0 ? Math.round(d.reduce((s, r) => s + r.porcentaje, 0) / d.length) : 0,
  }
})

async function generarReporte() {
  if (!filtroFicha.value) return
  try {
    const [estudiantes, asistencias] = await Promise.all([
      api.estudiantes.getAll({ fichaId: filtroFicha.value }),
      api.asistencias.getAll({ fichaId: filtroFicha.value, fechaDesde: fechaDesde.value || '', fechaHasta: fechaHasta.value || '' }),
    ])
    todosEstudiantes.value = estudiantes
    todasAsistencias.value = asistencias
    showPreview.value = true
  } catch (e) {
    console.error(e)
  }
}

function getFechaActual() {
  return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function descargarPDF() {
  const contenido = document.getElementById('reporte-print')
  if (!contenido) return
  const ventana = window.open('', '_blank', 'width=1100,height=850')
  ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Asistencias e Inasistencias</title><style>body{font-family:system-ui,sans-serif;padding:30px;color:#1e293b;font-size:12px}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;color:#64748b;margin-bottom:16px;font-weight:600}.info{background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px}.info p{margin:4px 0}.resumen{display:flex;gap:12px;margin-bottom:20px}.resumen div{flex:1;text-align:center;padding:12px;border-radius:8px;background:#f1f5f9}.resumen strong{display:block;font-size:22px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}.badge-danger{color:#dc2626;font-weight:bold}.badge-info{color:#0284c7;font-weight:bold}.badge-warning{color:#d97706;font-weight:bold}.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}@media print{body{padding:15px}}</style></head><body>${contenido.innerHTML}</body></html>`)
  ventana.document.close()
  setTimeout(() => ventana.print(), 500)
}

function descargarXLSX() {
  const d = datosReporteFiltrados.value
  const f = fichaSeleccionada.value
  let csv = '\uFEFFREPORTE DETALLADO DE ASISTENCIAS E INASISTENCIAS\n'
  csv += `Ficha: ${f ? f.codigoFicha + ' - ' + f.nombrePrograma : ''}\n`
  csv += `Jornada: ${f ? f.jornada : ''} (${horasPorJornada.value}h/dia) | Aula: ${f ? f.aulaAsignada : ''}\n`
  csv += `Periodo: ${fechaDesde.value || 'Inicio'} al ${fechaHasta.value || 'Fin'}\n`
  csv += `Filtro Aplicado: ${filtroTipoInasistencia.value === 'sin_excusa' ? 'Solo Injustificadas' : filtroTipoInasistencia.value === 'con_excusa' ? 'Solo Justificadas' : 'Todas las inasistencias'}\n`
  csv += `Generado: ${getFechaActual()}\n\n`
  csv += 'Tipo_Doc,Num_Doc,Nombres,Apellidos,Presentes,Tardanzas,Hrs_Total_Falladas,Hrs_Sin_Excusa,Hrs_Con_Excusa,% Asistencia,Motivos_Excusas\n'
  d.forEach(r => {
    const motivosStr = `"${r.motivos.join('; ')}"`
    csv += `${r.estudiante.tipoDocumento},${r.estudiante.numeroDocumento},${r.estudiante.nombres},${r.estudiante.apellidos},${r.presentes},${r.tardanzas},${r.horasTotalesFalladas} hrs,${r.horasSinExcusa} hrs,${r.horasConExcusa} hrs,${r.porcentaje}%,${motivosStr}\n`
  })
  csv += `\nCONSOLIDADO INSTITUCIONAL\nTotal Estudiantes,${resumenReporte.value.totalEstudiantes}\n% Asistencia General,${resumenReporte.value.porcentajeGeneral}%\nTotal Presentes,${resumenReporte.value.totalPresentes}\nTotal Tardanzas,${resumenReporte.value.totalTardanzas}\nTotal Horas Falladas,${resumenReporte.value.totalHorasFalladas} hrs\nTotal Horas Sin Excusa (Injustificadas),${resumenReporte.value.totalHorasSinExcusa} hrs\nTotal Horas Con Excusa (Justificadas),${resumenReporte.value.totalHorasConExcusa} hrs\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Reporte_Inasistencias_${f ? f.codigoFicha : 'ficha'}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function limpiar() {
  filtroFicha.value = null
  fechaDesde.value = ''
  fechaHasta.value = ''
  filtroTipoInasistencia.value = 'todas'
  showPreview.value = false
}
</script>

<template>
  <div class="page-header">
    <h1>Reportes e Inasistencias</h1>
    <p>Genera y descarga reportes detallados con horas de inasistencia, desglose con excusa y sin excusa para el Comité de Evaluación</p>
  </div>

  <div v-if="usuario.rol === 'Instructor' && fichasLideradas.length === 0" class="card" style="background: #fff1f2; border-color: #fecdd3; color: #9f1239; padding: 20px;">
    <strong>🔒 Acceso Restringido a Reportes:</strong> Como Docente Común no tienes asignada ninguna Ficha bajo tu liderazgo. La generación de reportes está reservada para el Administrador o Docente Líder de Ficha.
  </div>

  <div v-else class="card">
    <div class="card-header"><h3>Parámetros del Reporte</h3></div>
    <div class="form-grid">
      <div class="form-group">
        <label>Ficha</label>
        <select v-model="filtroFicha" @change="showPreview = false">
          <option :value="null" disabled>Selecciona una ficha</option>
          <option v-for="f in fichasLideradas" :key="f._id" :value="f._id">{{ f.codigoFicha }} - {{ f.nombrePrograma }}</option>
        </select>
      </div>
      <div class="form-group"><label>Fecha Desde</label><input v-model="fechaDesde" type="date" /></div>
      <div class="form-group"><label>Fecha Hasta</label><input v-model="fechaHasta" type="date" /></div>
      <div class="form-group">
        <label>Formato</label>
        <select v-model="formato">
          <option value="pdf">PDF (Impresión / Comité)</option>
          <option value="xlsx">XLSX (CSV Excel)</option>
        </select>
      </div>
    </div>

    <!-- FILTRO RÁPIDO DE HORAS E INASISTENCIAS -->
    <div style="margin-top: 16px; padding: 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
      <label style="display: block; font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #334155;">
        🎯 Filtro de Inasistencias y Horas:
      </label>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button
          class="btn btn-sm"
          :class="filtroTipoInasistencia === 'todas' ? 'btn-primary' : 'btn-outline'"
          @click="filtroTipoInasistencia = 'todas'"
        >
          📊 Horas Totales (Todas)
        </button>
        <button
          class="btn btn-sm"
          :class="filtroTipoInasistencia === 'sin_excusa' ? 'btn-danger' : 'btn-outline'"
          @click="filtroTipoInasistencia = 'sin_excusa'"
        >
          ❌ Solo Sin Excusa (Injustificadas)
        </button>
        <button
          class="btn btn-sm"
          :class="filtroTipoInasistencia === 'con_excusa' ? 'btn-info' : 'btn-outline'"
          @click="filtroTipoInasistencia = 'con_excusa'"
        >
          📋 Solo Con Excusa (Justificadas)
        </button>
      </div>
    </div>

    <div class="btn-group" style="margin-top: 20px;">
      <button class="btn btn-primary" :disabled="!filtroFicha" @click="generarReporte">Generar Reporte</button>
      <button class="btn btn-outline" @click="limpiar">Limpiar</button>
    </div>
  </div>

  <div v-if="showPreview && fichaSeleccionada" id="reporte-print">
    <div class="card">
      <div class="card-header">
        <h3>Vista Previa del Reporte</h3>
        <div class="btn-group">
          <button v-if="formato === 'pdf'" class="btn btn-primary btn-sm" @click="descargarPDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar PDF
          </button>
          <button v-else class="btn btn-success btn-sm" @click="descargarXLSX">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar CSV (Excel)
          </button>
        </div>
      </div>

      <div class="reporte-header">
        <h2>REPORTE CONSOLIDADO DE ASISTENCIAS E INASISTENCIAS</h2>
        <p>SENA - Centro de Formación | Comité de Evaluación y Seguimiento</p>
      </div>

      <div class="reporte-info">
        <div class="reporte-info-item"><strong>Ficha:</strong> {{ fichaSeleccionada.codigoFicha }} - {{ fichaSeleccionada.nombrePrograma }}</div>
        <div class="reporte-info-item"><strong>Jornada:</strong> {{ fichaSeleccionada.jornada }} ({{ horasPorJornada }} horas/día)</div>
        <div class="reporte-info-item"><strong>Aula Asignada:</strong> {{ fichaSeleccionada.aulaAsignada }}</div>
        <div class="reporte-info-item"><strong>Periodo Consultado:</strong> {{ fechaDesde || 'Inicio' }} al {{ fechaHasta || 'Fin' }}</div>
        <div class="reporte-info-item"><strong>Fecha de Generación:</strong> {{ getFechaActual() }}</div>
      </div>

      <!-- MÉTRICAS CONSOLIDADAS DE HORAS -->
      <div class="stats-row" style="margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
        <div class="stat-card stat-presente">
          <span class="stat-num">{{ resumenReporte.porcentajeGeneral }}%</span>
          <span class="stat-label">Asistencia General</span>
        </div>
        <div class="stat-card" style="border-left-color: #6366f1;">
          <span class="stat-num">{{ resumenReporte.totalHorasFalladas }}h</span>
          <span class="stat-label">Total Horas Ausente</span>
        </div>
        <div class="stat-card" style="border-left-color: #ef4444;">
          <span class="stat-num" style="color: #ef4444;">{{ resumenReporte.totalHorasSinExcusa }}h</span>
          <span class="stat-label">❌ Horas Sin Excusa</span>
        </div>
        <div class="stat-card" style="border-left-color: #0284c7;">
          <span class="stat-num" style="color: #0284c7;">{{ resumenReporte.totalHorasConExcusa }}h</span>
          <span class="stat-label">📋 Horas Con Excusa</span>
        </div>
        <div class="stat-card" style="border-left-color: #f59e0b;">
          <span class="stat-num">{{ resumenReporte.totalTardanzas }}</span>
          <span class="stat-label">Tardanzas</span>
        </div>
      </div>

      <div v-if="datosReporteFiltrados.length === 0" class="empty-state">
        <p>No se encontraron registros que coincidan con el filtro seleccionado ({{ filtroTipoInasistencia }}).</p>
      </div>

      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Aprendiz</th>
              <th>Documento</th>
              <th>Presentes</th>
              <th>Tardanzas</th>
              <th>Horas Totales Falladas</th>
              <th>❌ Sin Excusa</th>
              <th>📋 Con Excusa (Motivo)</th>
              <th>% Asistencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in datosReporteFiltrados" :key="r.estudiante._id">
              <td>{{ idx + 1 }}</td>
              <td><strong>{{ r.estudiante.nombres }} {{ r.estudiante.apellidos }}</strong></td>
              <td>{{ r.estudiante.tipoDocumento }} {{ r.estudiante.numeroDocumento }}</td>
              <td><span class="badge badge-success">{{ r.presentes }} d</span></td>
              <td><span class="badge badge-warning">{{ r.tardanzas }}</span></td>
              <td>
                <strong style="font-size: 14px; color: #1e293b;">
                  {{ r.horasTotalesFalladas }} hrs
                </strong>
              </td>
              <td>
                <span class="badge badge-danger" style="font-size: 13px;">
                  {{ r.horasSinExcusa }} hrs ({{ r.fallasSinExcusa }} d)
                </span>
              </td>
              <td>
                <div v-if="r.horasConExcusa > 0">
                  <span class="badge badge-info" style="font-size: 13px;">
                    📋 {{ r.horasConExcusa }} hrs ({{ r.fallasConExcusa }} d)
                  </span>
                  <div v-if="r.motivos.length > 0" style="font-size: 11px; color: #64748b; margin-top: 4px;">
                    <span v-for="(m, mIdx) in r.motivos" :key="mIdx" style="display: block;">• {{ m }}</span>
                  </div>
                </div>
                <span v-else style="color: #94a3b8; font-size: 12px;">—</span>
              </td>
              <td>
                <strong :style="{ color: r.porcentaje >= 80 ? '#22c55e' : r.porcentaje >= 60 ? '#f59e0b' : '#ef4444' }">
                  {{ r.totalDias > 0 ? r.porcentaje + '%' : 'S/R' }}
                </strong>
              </td>
              <td>
                <span v-if="r.horasSinExcusa >= 18" class="badge badge-danger">Comité</span>
                <span v-else-if="r.porcentaje < 60" class="badge badge-danger">Crítico</span>
                <span v-else-if="r.porcentaje >= 80" class="badge badge-success">Cumple</span>
                <span v-else class="badge badge-warning">En Alerta</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="reporte-footer">
        <p>Documento oficial generado automáticamente por el Sistema de Asistencias SENA.</p>
        <p>Las horas de inasistencia justificadas con motivo registrado no implican deserción, pero constan como tiempo de formación no presencial.</p>
      </div>
    </div>
  </div>
</template>
