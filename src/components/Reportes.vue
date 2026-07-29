<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api.js'

const filtroFicha = ref(null)
const fechaDesde = ref('')
const fechaHasta = ref('')
const formato = ref('pdf')
const showPreview = ref(false)

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
  return estudiantesFicha.value.map(est => {
    let presentes = 0, tardanzas = 0, fallas = 0
    fechasUnicas.value.forEach(fecha => {
      const reg = todasAsistencias.value.find(a => a.estudianteId === est._id && a.fecha === fecha && a.fichaId === filtroFicha.value)
      if (reg) {
        if (reg.estado === 'Presente') presentes++
        else if (reg.estado === 'Tardanza') tardanzas++
        else fallas++
      }
    })
    const total = presentes + tardanzas + fallas
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0
    return { estudiante: est, presentes, tardanzas, fallas, total, porcentaje }
  })
})

const resumenReporte = computed(() => {
  const d = datosReporte.value
  return {
    totalEstudiantes: d.length,
    totalPresentes: d.reduce((s, r) => s + r.presentes, 0),
    totalTardanzas: d.reduce((s, r) => s + r.tardanzas, 0),
    totalFallas: d.reduce((s, r) => s + r.fallas, 0),
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
  const ventana = window.open('', '_blank', 'width=1000,height=800')
  ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Asistencias</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#1e293b;font-size:13px}h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;color:#64748b;margin-bottom:20px;font-weight:400}.info{background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:24px}.info p{margin:4px 0}.resumen{display:flex;gap:20px;margin-bottom:24px}.resumen div{flex:1;text-align:center;padding:16px;border-radius:8px;background:#f1f5f9}.resumen strong{display:block;font-size:28px}table{width:100%;border-collapse:collapse;margin-bottom:24px}th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #e2e8f0}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}@media print{body{padding:20px}}</style></head><body>${contenido.innerHTML}</body></html>`)
  ventana.document.close()
  setTimeout(() => ventana.print(), 500)
}

function descargarXLSX() {
  const d = datosReporte.value
  const f = fichaSeleccionada.value
  let csv = '\uFEFFREPORTE DE ASISTENCIAS\n'
  csv += `Ficha: ${f ? f.codigoFicha + ' - ' + f.nombrePrograma : ''}\n`
  csv += `Jornada: ${f ? f.jornada : ''} | Aula: ${f ? f.aulaAsignada : ''}\n`
  csv += `Periodo: ${fechaDesde.value || 'Inicio'} al ${fechaHasta.value || 'Fin'}\n`
  csv += `Generado: ${getFechaActual()}\n\n`
  csv += 'Tipo_Doc,Num_Doc,Nombres,Apellidos,Presentes,Tardanzas,Fallas,% Asistencia\n'
  d.forEach(r => { csv += `${r.estudiante.tipoDocumento},${r.estudiante.numeroDocumento},${r.estudiante.nombres},${r.estudiante.apellidos},${r.presentes},${r.tardanzas},${r.fallas},${r.porcentaje}%\n` })
  csv += `\nRESUMEN\nTotal Estudiantes,${resumenReporte.value.totalEstudiantes}\n% Asistencia General,${resumenReporte.value.porcentajeGeneral}%\nTotal Presentes,${resumenReporte.value.totalPresentes}\nTotal Tardanzas,${resumenReporte.value.totalTardanzas}\nTotal Fallas,${resumenReporte.value.totalFallas}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Reporte_Asistencias_${f ? f.codigoFicha : 'ficha'}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function limpiar() {
  filtroFicha.value = null
  fechaDesde.value = ''
  fechaHasta.value = ''
  showPreview.value = false
}
</script>

<template>
  <div class="page-header">
    <h1>Reportes</h1>
    <p>Genera y descarga reportes detallados de asistencias para el comite de evaluacion</p>
  </div>

  <div v-if="usuario.rol === 'Instructor' && fichasLideradas.length === 0" class="card" style="background: #fff1f2; border-color: #fecdd3; color: #9f1239; padding: 20px;">
    <strong>🔒 Acceso Restringido a Reportes:</strong> Como Docente Común no tienes asignada ninguna Ficha bajo tu liderazgo. La generación de reportes está reservada para el Administrador o Docente Líder de Ficha.
  </div>

  <div v-else class="card">
    <div class="card-header"><h3>Parametros del Reporte</h3></div>
    <div class="form-grid">
      <div class="form-group"><label>Ficha</label><select v-model="filtroFicha" @change="showPreview = false"><option :value="null" disabled>Selecciona una ficha</option><option v-for="f in fichasLideradas" :key="f._id" :value="f._id">{{ f.codigoFicha }} - {{ f.nombrePrograma }}</option></select></div>
      <div class="form-group"><label>Fecha Desde</label><input v-model="fechaDesde" type="date" /></div>
      <div class="form-group"><label>Fecha Hasta</label><input v-model="fechaHasta" type="date" /></div>
      <div class="form-group"><label>Formato</label><select v-model="formato"><option value="pdf">PDF (Impresion)</option><option value="xlsx">XLSX (CSV Excel)</option></select></div>
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
          <button v-if="formato === 'pdf'" class="btn btn-primary btn-sm" @click="descargarPDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar PDF</button>
          <button v-else class="btn btn-success btn-sm" @click="descargarXLSX"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar CSV (Excel)</button>
        </div>
      </div>

      <div class="reporte-header"><h2>REPORTE DE ASISTENCIAS</h2><p>SENA - Comite de Evaluacion</p></div>
      <div class="reporte-info">
        <div class="reporte-info-item"><strong>Ficha:</strong> {{ fichaSeleccionada.codigoFicha }} - {{ fichaSeleccionada.nombrePrograma }}</div>
        <div class="reporte-info-item"><strong>Jornada:</strong> {{ fichaSeleccionada.jornada }}</div>
        <div class="reporte-info-item"><strong>Aula:</strong> {{ fichaSeleccionada.aulaAsignada }}</div>
        <div class="reporte-info-item"><strong>Periodo:</strong> {{ fechaDesde || 'Inicio' }} al {{ fechaHasta || 'Fin' }}</div>
        <div class="reporte-info-item"><strong>Fecha de generacion:</strong> {{ getFechaActual() }}</div>
      </div>

      <div class="stats-row" style="margin-bottom: 20px;">
        <div class="stat-card stat-presente"><span class="stat-num">{{ resumenReporte.porcentajeGeneral }}%</span><span class="stat-label">Asistencia General</span></div>
        <div class="stat-card" style="border-left-color: #22c55e;"><span class="stat-num">{{ resumenReporte.totalPresentes }}</span><span class="stat-label">Presentes</span></div>
        <div class="stat-card" style="border-left-color: #f59e0b;"><span class="stat-num">{{ resumenReporte.totalTardanzas }}</span><span class="stat-label">Tardanzas</span></div>
        <div class="stat-card" style="border-left-color: #ef4444;"><span class="stat-num">{{ resumenReporte.totalFallas }}</span><span class="stat-label">Fallas</span></div>
      </div>

      <div v-if="datosReporte.length === 0" class="empty-state"><p>No hay estudiantes en esta ficha o no hay datos de asistencia en el periodo seleccionado.</p></div>

      <div v-else class="table-container">
        <table>
          <thead><tr><th>#</th><th>Estudiante</th><th>Documento</th><th>Presentes</th><th>Tardanzas</th><th>Fallas</th><th>% Asistencia</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="(r, idx) in datosReporte" :key="r.estudiante._id">
              <td>{{ idx + 1 }}</td>
              <td><strong>{{ r.estudiante.nombres }} {{ r.estudiante.apellidos }}</strong></td>
              <td>{{ r.estudiante.tipoDocumento }} {{ r.estudiante.numeroDocumento }}</td>
              <td><span class="badge badge-success">{{ r.presentes }}</span></td>
              <td><span class="badge badge-warning">{{ r.tardanzas }}</span></td>
              <td><span class="badge badge-danger">{{ r.fallas }}</span></td>
              <td><strong :style="{ color: r.porcentaje >= 80 ? '#22c55e' : r.porcentaje >= 60 ? '#f59e0b' : '#ef4444' }">{{ r.total > 0 ? r.porcentaje + '%' : 'S/R' }}</strong></td>
              <td><span v-if="r.porcentaje < 60" class="badge badge-danger">Bajo</span><span v-else-if="r.porcentaje >= 80" class="badge badge-success">Cumple</span><span v-else class="badge badge-warning">Regular</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="reporte-footer"><p>Documento generado automaticamente por el Sistema de Administracion SENA</p><p>Este reporte puede ser presentado ante el comite de evaluacion como evidencia de asistencia.</p></div>
    </div>
  </div>
</template>
