<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'
import './diasFestivos.css'

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
  if (motivo === 'Festivo') return 'holidays-badge-primary'
  if (motivo === 'Jornada Pedagogica' || motivo === 'Jornada Pedagógica') return 'holidays-badge-warning'
  return 'holidays-badge-special'
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
  <div class="holidays-page-header">
    <h1>Días Festivos y Recesos</h1>
    <p>Sincroniza festivos de Colombia vía API o márcalos manualmente</p>
  </div>

  <div class="holidays-card">
    <div class="holidays-card-header">
      <h3>Calendario de Días No Laborables</h3>
      <div class="holidays-button-group">
        <button class="holidays-button holidays-button-outline" @click="sincronizarAPI" :disabled="sincronizandoAPI">
          {{ sincronizandoAPI ? '⏳ Sincronizando...' : '🌐 Sincronizar Festivos Colombia (API)' }}
        </button>
        <button class="holidays-button holidays-button-primary" @click="openCreate">
          ➕ Marcar Día Manual
        </button>
      </div>
    </div>

    <div v-if="diasOrdenados.length === 0" class="holidays-empty-state">
      <p>No hay días festivos marcados. Puedes sincronizarlos automáticamente vía API o usar el botón de registro manual.</p>
    </div>

    <div v-else>
      <div v-if="diasFuturos.length > 0" class="holidays-upcoming-section">
        <h4 class="holidays-section-title">Próximos Días No Laborables</h4>
        <div class="holidays-grid">
          <div v-for="d in diasFuturos" :key="d._id" class="holidays-card-item" :class="{ 'holidays-card-today': esHoy(d.fecha) }">
            <div class="holidays-date-box">
              <span class="holidays-date-day">{{ d.fecha.slice(8) }}</span>
              <span class="holidays-date-month">{{ new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short' }) }}</span>
            </div>
            <div class="holidays-item-info">
              <strong>{{ d.descripcion || d.motivo }}</strong>
              <span class="holidays-badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span>
              <span class="holidays-item-fiches">{{ getFichasNombres(d) }}</span>
            </div>
            <div class="holidays-button-group">
              <button class="holidays-button holidays-button-outline holidays-button-small" @click="openEdit(d)">✏️ Editar</button>
              <button class="holidays-button holidays-button-danger holidays-button-small" @click="eliminarDiaFestivo(d._id)">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="diasPasados.length > 0">
        <h4 class="holidays-section-title holidays-section-title-past">Días Anteriores ({{ diasPasados.length }})</h4>
        <div class="holidays-table-container">
          <table class="holidays-table">
            <thead><tr><th>Fecha</th><th>Motivo</th><th>Descripción</th><th>Fichas</th><th>Acciones</th></tr></thead>
            <tbody>
              <tr v-for="d in diasPasados" :key="d._id">
                <td>{{ formatFecha(d.fecha) }}</td>
                <td><span class="holidays-badge" :class="motivoBadge(d.motivo)">{{ d.motivo }}</span></td>
                <td>{{ d.descripcion || '—' }}</td>
                <td class="holidays-fiches-cell">{{ getFichasNombres(d) }}</td>
                <td>
                  <div class="holidays-button-group">
                    <button class="holidays-button holidays-button-outline holidays-button-small" @click="openEdit(d)">✏️ Editar</button>
                    <button class="holidays-button holidays-button-danger holidays-button-small" @click="eliminarDiaFestivo(d._id)">🗑️ Eliminar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showModal" class="holidays-modal-overlay" @click.self="closeModal">
    <div class="holidays-modal">
      <h2>{{ editingId ? '✏️ Editar' : '➕ Marcar' }} Día Festivo (Manual)</h2>
      <div class="holidays-form-grid">
        <div class="holidays-form-group"><label>Fecha *</label><input v-model="diaFestivoForm.fecha" type="date" /></div>
        <div class="holidays-form-group">
          <label>Motivo *</label>
          <select v-model="diaFestivoForm.motivo">
            <option value="Festivo">Festivo Oficial</option>
            <option value="Jornada Pedagogica">Jornada Pedagógica</option>
            <option value="Receso">Receso / Vacaciones</option>
          </select>
        </div>
        <div class="holidays-form-group"><label>Descripción (Opcional)</label><input v-model="diaFestivoForm.descripcion" type="text" placeholder="Ej: Día de la Independencia, Aniversario..." /></div>
        <div class="holidays-form-group"><label>Aplicable a</label><select v-model="diaFestivoForm.fichasAplicables"><option value="todas">Todas las fichas</option><option value="especificas">Fichas específicas</option></select></div>
      </div>
      <div v-if="diaFestivoForm.fichasAplicables === 'especificas'" class="holidays-selection-section">
        <label class="holidays-selection-label">Selecciona las fichas</label>
        <div class="holidays-fiches-check-grid">
          <label v-for="f in fichasList" :key="f._id" class="holidays-fiche-check-item">
            <input type="checkbox" :checked="diaFestivoForm.fichasSeleccionadas.includes(f._id)" @change="toggleFicha(f._id)" /><span>{{ f.codigoFicha }} - {{ f.nombrePrograma }}</span>
          </label>
        </div>
      </div>
      <div class="holidays-modal-actions">
        <button class="holidays-button holidays-button-outline" @click="closeModal">Cancelar</button>
        <button class="holidays-button holidays-button-primary" @click="guardarDiaFestivo" :disabled="loading">{{ loading ? 'Guardando...' : (editingId ? '💾 Actualizar' : '➕ Registrar') }}</button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="holidays-toast" :class="'holidays-toast-' + toast.type">{{ toast.message }}</div>
</template>
