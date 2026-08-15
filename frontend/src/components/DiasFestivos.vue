<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const editingId = ref(null)
const loading = ref(false)
const sincronizandoAPI = ref(false)

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

async function sincronizarAPI() {
  sincronizandoAPI.value = true
  try {
    const anioActual = new Date().getFullYear()
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${anioActual}/CO`)
    if (!res.ok) throw new Error('No se pudo conectar con el servicio de festivos')
    
    const festivosAPI = await res.json()
    let agregados = 0

    for (const fest of festivosAPI) {
      const yaExiste = diasFestivos.value.some(d => d.fecha === fest.date)
      if (!yaExiste) {
        await api.diasFestivos.create({
          fecha: fest.date,
          motivo: 'Festivo',
          descripcion: fest.localName || fest.name,
          fichasAplicables: 'todas',
          fichasSeleccionadas: []
        })
        agregados++
      }
    }

    await loadDiasFestivos()
    if (agregados > 0) {
      showToastFn(`Se sincronizaron ${agregados} días festivos de Colombia (${anioActual}) automáticamente`)
    } else {
      showToastFn(`Los días festivos oficiales de Colombia (${anioActual}) ya están registrados`)
    }
  } catch (err) {
    showToastFn('Error al sincronizar con la API: ' + err.message, 'error')
  } finally {
    sincronizandoAPI.value = false
  }
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
      showToastFn('Día festivo actualizado correctamente')
    } else {
      await api.diasFestivos.create(body)
      showToastFn('Día festivo registrado correctamente')
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
  if (!confirm('¿Deseas eliminar este día festivo?')) return
  try {
    await api.diasFestivos.delete(id)
    await loadDiasFestivos()
    showToastFn('Día festivo eliminado correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function motivoBadge(motivo) {
  if (motivo === 'Festivo') return 'badge-primary'
  if (motivo === 'Jornada Pedagogica' || motivo === 'Jornada Pedagógica') return 'badge-warning'
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
    <h1>Días Festivos y Recesos</h1>
    <p>Sincroniza festivos de Colombia vía API o márcalos manualmente</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Calendario de Días No Laborables</h3>
      <div class="btn-group">
        <button class="btn btn-outline" @click="sincronizarAPI" :disabled="sincronizandoAPI">
          {{ sincronizandoAPI ? '⏳ Sincronizando...' : '🌐 Sincronizar Festivos Colombia (API)' }}
        </button>
        <button class="btn btn-primary" @click="openCreate">
          ➕ Marcar Día Manual
        </button>
      </div>
    </div>

    <div v-if="diasOrdenados.length === 0" class="empty-state">
      <p>No hay días festivos marcados. Puedes sincronizarlos automáticamente vía API o usar el botón de registro manual.</p>
    </div>

    <div v-else>
      <div v-if="diasFuturos.length > 0" style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text);">Próximos Días No Laborables</h4>
        <div class="festivos-grid">
          <div v-for="d in diasFuturos" :key="d._id" class="festivo-card" :class="{ 'festivo-hoy': esHoy(d.fecha) }">
            <div class="festivo-fecha">
              <span class="festivo-dia">{{ d.fecha.slice(8) }}</span>
              <span class="festivo-mes">{{ new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short' }) }}</span>
            </div>
            <div class="festivo-info">
              <strong>{{ d.descripcion || d.motivo }}</strong>
              <span class="badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">{{ getFichasNombres(d) }}</span>
            </div>
            <div class="btn-group">
              <button class="btn btn-outline btn-sm" @click="openEdit(d)">✏️ Editar</button>
              <button class="btn btn-danger btn-sm" @click="eliminarDiaFestivo(d._id)">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="diasPasados.length > 0">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary);">Días Anteriores ({{ diasPasados.length }})</h4>
        <div class="table-container">
          <table>
            <thead><tr><th>Fecha</th><th>Motivo</th><th>Descripción</th><th>Fichas</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="d in diasPasados" :key="d._id">
                <td>{{ formatFecha(d.fecha) }}</td>
                <td><span class="badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span></td>
                <td>{{ d.descripcion || '—' }}</td>
                <td style="font-size: 12px;">{{ getFichasNombres(d) }}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-outline btn-sm" @click="openEdit(d)">✏️ Editar</button>
                    <button class="btn btn-danger btn-sm" @click="eliminarDiaFestivo(d._id)">🗑️ Eliminar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <h2>{{ editingId ? '✏️ Editar' : '➕ Marcar' }} Día Festivo (Manual)</h2>
      <div class="form-grid">
        <div class="form-group"><label>Fecha *</label><input v-model="diaFestivoForm.fecha" type="date" /></div>
        <div class="form-group">
          <label>Motivo *</label>
          <select v-model="diaFestivoForm.motivo">
            <option value="Festivo">Festivo Oficial</option>
            <option value="Jornada Pedagogica">Jornada Pedagógica</option>
            <option value="Receso">Receso / Vacaciones</option>
          </select>
        </div>
        <div class="form-group"><label>Descripción (Opcional)</label><input v-model="diaFestivoForm.descripcion" type="text" placeholder="Ej: Día de la Independencia, Aniversario..." /></div>
        <div class="form-group"><label>Aplicable a</label><select v-model="diaFestivoForm.fichasAplicables"><option value="todas">Todas las fichas</option><option value="especificas">Fichas específicas</option></select></div>
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
        <button class="btn btn-primary" @click="guardarDiaFestivo" :disabled="loading">{{ loading ? 'Guardando...' : (editingId ? '💾 Actualizar' : '➕ Registrar') }}</button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>

<style scoped>
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 24px; font-weight: 700; color: #1e293b; }
.page-header p { color: #64748b; font-size: 14px; }
.card { background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.card-header h3 { font-size: 16px; font-weight: 700; color: #1e293b; }
.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
.festivos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.festivo-card { display: flex; align-items: center; gap: 14px; padding: 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #cbd5e1; }
.festivo-hoy { border-color: #3b82f6; background: #eff6ff; }
.festivo-fecha { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 50px; height: 50px; background: #fff; border-radius: 8px; border: 1px solid #cbd5e1; flex-shrink: 0; }
.festivo-dia { font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1; }
.festivo-mes { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
.festivo-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.fichas-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; max-height: 180px; overflow-y: auto; padding: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; }
.ficha-check-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; font-size: 13px; }
.toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-weight: 600; color: white; z-index: 9999; }
.toast-success { background: #16a34a; }
.toast-error { background: #dc2626; }
</style>
