<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const editingId = ref(null)
const loading = ref(false)

const diaFestivoForm = reactive({
  fecha: '', motivo: 'Festivo', fichasAplicables: 'todas',
  fichasSeleccionadas: [], descripcion: '',
})

const diasFestivos = ref([])
const fichasList = ref([])

onMounted(async () => {
  await Promise.all([loadDiasFestivos(), loadFichas()])
})

async function loadDiasFestivos() {
  try { diasFestivos.value = await api.diasFestivos.getAll() } catch (e) {}
}

async function loadFichas() {
  try { fichasList.value = await api.fichas.getAll() } catch (e) {}
}

const diasOrdenados = computed(() => [...diasFestivos.value].sort((a, b) => a.fecha.localeCompare(b.fecha)))

const diasFuturos = computed(() => {
  const hoy = new Date().toISOString().slice(0, 10)
  return diasOrdenados.value.filter(d => d.fecha >= hoy)
})

const diasPasados = computed(() => {
  const hoy = new Date().toISOString().slice(0, 10)
  return diasOrdenados.value.filter(d => d.fecha < hoy)
})

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function openCreate() {
  editingId.value = null
  Object.assign(diaFestivoForm, { fecha: '', motivo: 'Festivo', fichasAplicables: 'todas', fichasSeleccionadas: [], descripcion: '' })
  showModal.value = true
}

function openEdit(dia) {
  editingId.value = dia._id
  Object.assign(diaFestivoForm, {
    fecha: dia.fecha, motivo: dia.motivo, fichasAplicables: dia.fichasAplicables,
    fichasSeleccionadas: (dia.fichasSeleccionadas || []).map(f => f._id || f),
    descripcion: dia.descripcion || '',
  })
  showModal.value = true
}

function closeModal() { showModal.value = false }

function toggleFicha(fichaId) {
  const idx = diaFestivoForm.fichasSeleccionadas.indexOf(fichaId)
  if (idx === -1) diaFestivoForm.fichasSeleccionadas.push(fichaId)
  else diaFestivoForm.fichasSeleccionadas.splice(idx, 1)
}

async function guardarDiaFestivo() {
  if (!diaFestivoForm.fecha || !diaFestivoForm.motivo) {
    showToastFn('Completa todos los campos obligatorios', 'error')
    return
  }
  loading.value = true
  try {
    const body = {
      fecha: diaFestivoForm.fecha, motivo: diaFestivoForm.motivo,
      fichasAplicables: diaFestivoForm.fichasAplicables,
      fichasSeleccionadas: diaFestivoForm.fichasSeleccionadas,
      descripcion: diaFestivoForm.descripcion,
    }
    if (editingId.value) {
      await api.diasFestivos.update(editingId.value, body)
      showToastFn('Dia festivo actualizado correctamente')
    } else {
      await api.diasFestivos.create(body)
      showToastFn('Dia festivo registrado correctamente')
    }
    await loadDiasFestivos()
    closeModal()
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function eliminarDiaFestivo(id) {
  try {
    await api.diasFestivos.delete(id)
    await loadDiasFestivos()
    showToastFn('Dia festivo eliminado correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function motivoBadge(motivo) {
  if (motivo === 'Festivo') return 'badge-primary'
  if (motivo === 'Jornada Pedagogica') return 'badge-warning'
  return 'badge-ficha'
}

function getFichasNombres(dia) {
  if (dia.fichasAplicables === 'todas') return 'Todas las fichas'
  if (!dia.fichasSeleccionadas || dia.fichasSeleccionadas.length === 0) return 'Todas las fichas'
  return dia.fichasSeleccionadas.map(id => {
    const f = fichasList.value.find(f => (f._id === id) || (f._id === id._id))
    return f ? f.codigoFicha : ''
  }).filter(Boolean).join(', ')
}

function formatFecha(fecha) {
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function esHoy(fecha) { return fecha === new Date().toISOString().slice(0, 10) }
</script>

<template>
  <div class="page-header">
    <h1>Dias Festivos</h1>
    <p>Marca dias festivos, jornadas pedagogicas y recesos para evitar inasistencias automaticas</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Calendario de Dias No Laborables</h3>
      <button class="btn btn-primary" @click="openCreate">+ Marcar Dia</button>
    </div>

    <div v-if="diasOrdenados.length === 0" class="empty-state">
      <p>No hay dias festivos marcados. Usa el boton "Marcar Dia" para agregar fechas no laborables.</p>
    </div>

    <div v-else>
      <div v-if="diasFuturos.length > 0" style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text);">Proximos Dias</h4>
        <div class="festivos-grid">
          <div v-for="d in diasFuturos" :key="d._id" class="festivo-card" :class="{ 'festivo-hoy': esHoy(d.fecha) }">
            <div class="festivo-fecha"><span class="festivo-dia">{{ d.fecha.slice(8) }}</span><span class="festivo-mes">{{ new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short' }) }}</span></div>
            <div class="festivo-info"><strong>{{ d.descripcion || d.motivo }}</strong><span class="badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span><span style="font-size: 11px; color: var(--text-secondary);">{{ getFichasNombres(d) }}</span></div>
            <div class="btn-group"><button class="btn btn-outline btn-sm" @click="openEdit(d)">Editar</button><button class="btn btn-danger btn-sm" @click="eliminarDiaFestivo(d._id)">Eliminar</button></div>
          </div>
        </div>
      </div>

      <div v-if="diasPasados.length > 0">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary);">Dias Anteriores ({{ diasPasados.length }})</h4>
        <div class="table-container">
          <table>
            <thead><tr><th>Fecha</th><th>Motivo</th><th>Descripcion</th><th>Fichas</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="d in diasPasados" :key="d._id">
                <td>{{ formatFecha(d.fecha) }}</td>
                <td><span class="badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span></td>
                <td>{{ d.descripcion || '—' }}</td>
                <td style="font-size: 12px;">{{ getFichasNombres(d) }}</td>
                <td><div class="btn-group"><button class="btn btn-outline btn-sm" @click="openEdit(d)">Editar</button><button class="btn btn-danger btn-sm" @click="eliminarDiaFestivo(d._id)">Eliminar</button></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <h2>{{ editingId ? 'Editar' : 'Marcar' }} Dia Festivo</h2>
      <div class="form-grid">
        <div class="form-group"><label>Fecha</label><input v-model="diaFestivoForm.fecha" type="date" /></div>
        <div class="form-group"><label>Motivo</label><select v-model="diaFestivoForm.motivo"><option value="Festivo">Festivo</option><option value="Jornada Pedagogica">Jornada Pedagogica</option><option value="Receso">Receso</option></select></div>
        <div class="form-group"><label>Descripcion (opcional)</label><input v-model="diaFestivoForm.descripcion" type="text" placeholder="Ej: Dia del Trabajo, Semana Santa..." /></div>
        <div class="form-group"><label>Aplicable a</label><select v-model="diaFestivoForm.fichasAplicables"><option value="todas">Todas las fichas</option><option value="especificas">Fichas especificas</option></select></div>
      </div>
      <div v-if="diaFestivoForm.fichasAplicables === 'especificas'" style="margin-top: 16px;">
        <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Selecciona las fichas</label>
        <div class="fichas-check-grid">
          <label v-for="f in fichasList" :key="f._id" class="ficha-check-item">
            <input type="checkbox" :checked="diaFestivoForm.fichasSeleccionadas.includes(f._id)" @change="toggleFicha(f._id)" /><span>{{ f.codigoFicha }} - {{ f.nombrePrograma }}</span>
          </label>
        </div>
      </div>
      <div class="btn-group" style="margin-top: 24px; justify-content: flex-end;">
        <button class="btn btn-outline" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" @click="guardarDiaFestivo" :disabled="loading">{{ loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Marcar') + ' Dia' }}</button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>
