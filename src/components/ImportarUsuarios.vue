<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const tipoImportacion = ref('estudiantes')
const archivoNombre = ref('')
const registros = ref([])
const errores = ref([])
const importado = ref(false)
const loading = ref(false)

const HEADERS_ESPERADOS = ['Tipo_Doc', 'Num_Doc', 'Nombres', 'Apellidos', 'Genero', 'Correo', 'Telefono', 'Ficha', 'Jornada']

const fichasList = ref([])

onMounted(async () => {
  try { fichasList.value = await api.fichas.getAll() } catch (e) {}
})

function getFichaPorCodigo(codigo) {
  return fichasList.value.find(f => f.codigoFicha.toLowerCase() === codigo.toLowerCase())
}

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim())
  if (lineas.length < 2) {
    showToastFn('El archivo debe tener al menos una linea de cabecera y datos', 'error')
    return { headers: [], rows: [] }
  }
  const headers = parsearLineaCSV(lineas[0]).map(h => h.trim())
  const rows = []
  for (let i = 1; i < lineas.length; i++) {
    const valores = parsearLineaCSV(lineas[i])
    if (valores.length === 0) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = (valores[idx] || '').trim() })
    rows.push({ ...row, _linea: i + 1 })
  }
  return { headers, rows }
}

function parsearLineaCSV(linea) {
  const resultado = []
  let actual = ''
  let dentroDeComillas = false
  for (let i = 0; i < linea.length; i++) {
    const char = linea[i]
    if (char === '"') { dentroDeComillas = !dentroDeComillas }
    else if ((char === ',' || char === ';') && !dentroDeComillas) { resultado.push(actual); actual = '' }
    else { actual += char }
  }
  resultado.push(actual)
  return resultado
}

function validarHeaders(headers) { return HEADERS_ESPERADOS.every(h => headers.includes(h)) }

function validarFila(row, index) {
  const errs = []
  for (const h of HEADERS_ESPERADOS) { if (!row[h]) errs.push(`Falta el campo obligatorio: ${h}`) }
  if (row.Tipo_Doc && !['CC', 'CE', 'PEP'].includes(row.Tipo_Doc.toUpperCase())) errs.push(`Tipo_Doc invalido: "${row.Tipo_Doc}". Debe ser CC, CE o PEP`)
  if (row.Correo && !row.Correo.includes('@')) errs.push(`Correo invalido: "${row.Correo}"`)
  if (row.Ficha) {
    const ficha = getFichaPorCodigo(row.Ficha)
    if (!ficha) errs.push(`Ficha no encontrada: "${row.Ficha}"`)
    else if (row.Jornada && ficha.jornada !== row.Jornada) errs.push(`Jornada "${row.Jornada}" no coincide con la ficha "${row.Ficha}" (${ficha.jornada})`)
  }
  return errs
}

function procesarArchivo(event) {
  const file = event.target.files[0]
  if (!file) return
  archivoNombre.value = file.name
  registros.value = []
  errores.value = []
  importado.value = false
  const reader = new FileReader()
  reader.onload = (e) => {
    const texto = e.target.result
    const { headers, rows } = parsearCSV(texto)
    if (headers.length === 0 || rows.length === 0) { showToastFn('El archivo esta vacio o no se pudo leer', 'error'); return }
    if (!validarHeaders(headers)) { showToastFn('El archivo no contiene las cabeceras requeridas: ' + HEADERS_ESPERADOS.join(', '), 'error'); return }
    const tempRegistros = []
    const tempErrores = []
    rows.forEach((row, idx) => {
      const errs = validarFila(row, idx)
      if (errs.length > 0) tempErrores.push({ linea: row._linea, datos: row, errores: errs })
      else tempRegistros.push(row)
    })
    registros.value = tempRegistros
    errores.value = tempErrores
  }
  reader.readAsText(file, 'UTF-8')
}

async function ejecutarImportacion() {
  if (registros.value.length === 0) { showToastFn('No hay registros validos para importar', 'error'); return }
  const esEstudiantes = tipoImportacion.value === 'estudiantes'
  loading.value = true
  try {
    const items = registros.value.map(r => {
      const ficha = getFichaPorCodigo(r.Ficha)
      return {
        nombres: r.Nombres, apellidos: r.Apellidos,
        tipoDocumento: r.Tipo_Doc.toUpperCase(), numeroDocumento: r.Num_Doc,
        correo: r.Correo, telefono: r.Telefono,
        fichaId: ficha ? ficha._id : null,
        genero: r.Genero, estado: 'Activo', motivo: '', estadoAsistencia: 'Sin registro',
        ...(esEstudiantes ? {} : { especialidad: r.Ficha }),
      }
    })

    await api.estudiantes.importar(items)
    importado.value = true
    showToastFn(`${registros.value.length} estudiantes importados correctamente`)
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

function limpiarTodo() {
  archivoNombre.value = ''
  registros.value = []
  errores.value = []
  importado.value = false
  const input = document.getElementById('archivo-input')
  if (input) input.value = ''
}
</script>

<template>
  <div class="page-header">
    <h1>Importar Usuarios</h1>
    <p>Importa docentes o estudiantes mediante archivo CSV con log de errores</p>
  </div>

  <div class="card">
    <div class="card-header"><h3>Configuracion de Importacion</h3></div>
    <div class="form-grid">
      <div class="form-group"><label>Tipo de Usuario</label><select v-model="tipoImportacion" :disabled="archivoNombre !== ''"><option value="estudiantes">Estudiantes</option><option value="instructores">Instructores / Docentes</option></select></div>
      <div class="form-group">
        <label>Archivo CSV</label>
        <div class="file-upload-wrapper">
          <input id="archivo-input" type="file" accept=".csv" @change="procesarArchivo" class="file-input" />
          <label for="archivo-input" class="file-label">{{ archivoNombre || 'Seleccionar archivo .csv' }}</label>
        </div>
      </div>
    </div>
    <div class="import-info">
      <h4>Formato requerido del archivo CSV:</h4>
      <p>Cabeceras obligatorias (separadas por coma o punto y coma):</p>
      <code>Tipo_Doc,Num_Doc,Nombres,Apellidos,Genero,Correo,Telefono,Ficha,Jornada</code>
      <ul>
        <li><strong>Tipo_Doc:</strong> CC, CE o PEP</li>
        <li><strong>Ficha:</strong> Codigo de ficha existente en el sistema</li>
        <li><strong>Jornada:</strong> Debe coincidir con la jornada de la ficha</li>
        <li>Todos los campos son obligatorios</li>
      </ul>
    </div>
  </div>

  <div v-if="errores.length > 0" class="card">
    <div class="card-header"><h3>Errores de Validacion</h3><span class="badge badge-danger">{{ errores.length }} errores</span></div>
    <div class="table-container">
      <table>
        <thead><tr><th>Linea</th><th>Datos</th><th>Errores</th></tr></thead>
        <tbody>
          <tr v-for="(err, idx) in errores" :key="idx" class="fila-error">
            <td>{{ err.linea }}</td>
            <td style="font-size: 12px;">{{ err.datos.Nombres }} {{ err.datos.Apellidos }} ({{ err.datos.Num_Doc }})</td>
            <td><ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #dc2626;"><li v-for="(e, i) in err.errores" :key="i">{{ e }}</li></ul></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="registros.length > 0 && !importado" class="card">
    <div class="card-header"><h3>Registros Validos para Importar</h3><span class="badge badge-success">{{ registros.length }} registros</span></div>
    <div class="table-container">
      <table>
        <thead><tr><th>Tipo Doc</th><th>Nro Doc</th><th>Nombres</th><th>Apellidos</th><th>Genero</th><th>Correo</th><th>Telefono</th><th>Ficha</th><th>Jornada</th></tr></thead>
        <tbody><tr v-for="(r, idx) in registros.slice(0, 50)" :key="idx"><td>{{ r.Tipo_Doc }}</td><td>{{ r.Num_Doc }}</td><td>{{ r.Nombres }}</td><td>{{ r.Apellidos }}</td><td>{{ r.Genero }}</td><td>{{ r.Correo }}</td><td>{{ r.Telefono }}</td><td>{{ r.Ficha }}</td><td>{{ r.Jornada }}</td></tr></tbody>
      </table>
      <p v-if="registros.length > 50" style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 13px;">Mostrando 50 de {{ registros.length }} registros</p>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 12px;">
      <button class="btn btn-primary" @click="ejecutarImportacion" :disabled="loading">{{ loading ? 'Importando...' : 'Importar ' + registros.length + ' ' + (tipoImportacion === 'estudiantes' ? 'Estudiantes' : 'Instructores') }}</button>
      <button class="btn btn-outline" @click="limpiarTodo">Cancelar</button>
    </div>
  </div>

  <div v-if="importado" class="card">
    <div class="card-header"><h3>Importacion Completada</h3></div>
    <div class="import-resumen">
      <div class="import-stat success"><span class="import-stat-num">{{ registros.length }}</span><span>Importados correctamente</span></div>
      <div v-if="errores.length > 0" class="import-stat error"><span class="import-stat-num">{{ errores.length }}</span><span>Con errores (omitidos)</span></div>
    </div>
    <button class="btn btn-primary" @click="limpiarTodo" style="margin-top: 16px;">Nueva Importacion</button>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>
