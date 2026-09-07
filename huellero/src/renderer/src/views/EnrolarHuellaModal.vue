<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  claseActiva: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const DEDOS = [
  'Pulgar derecho',
  'Índice derecho',
  'Medio derecho',
  'Anular derecho',
  'Meñique derecho',
  'Pulgar izquierdo',
  'Índice izquierdo',
  'Medio izquierdo',
  'Anular izquierdo',
  'Meñique izquierdo',
]

const ficha = ref(null)
const estudiantes = ref([])
const cargando = ref(true)
const errorInicial = ref('')

const busqueda = ref('')
const seleccionadoId = ref(null)
const dedo = ref('')
const estadoCaptura = ref('idle')
const mensajeCaptura = ref('')

const hayClaseActiva = computed(() => !!props.claseActiva)

const estudiantesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return estudiantes.value
  return estudiantes.value.filter((e) =>
    `${e.nombres} ${e.apellidos} ${e.numeroDocumento}`.toLowerCase().includes(q)
  )
})

const seleccionado = computed(
  () => estudiantes.value.find((e) => e._id === seleccionadoId.value) || null
)

let offProgreso = null

onMounted(async () => {
  offProgreso = window.huellero.onEnrolarProgreso((p) => {
    mensajeCaptura.value = p.mensaje || ''
    if (p.fase === 'completado') {
      estadoCaptura.value = 'ok'
    } else if (p.fase === 'cancelado') {
      estadoCaptura.value = 'idle'
    } else {
      estadoCaptura.value = 'capturando'
    }
  })

  const fichaLider = await window.huellero.getFichaLider()
  if (!fichaLider.ok) {
    errorInicial.value = fichaLider.error
    cargando.value = false
    return
  }
  ficha.value = fichaLider.ficha

  const resEstudiantes = await window.huellero.getEstudiantesFicha(fichaLider.ficha._id)
  if (!resEstudiantes.ok) {
    errorInicial.value = resEstudiantes.error
    cargando.value = false
    return
  }

  estudiantes.value = resEstudiantes.estudiantes
  cargando.value = false
})

onUnmounted(() => {
  if (offProgreso) offProgreso()
})

function seleccionar(id) {
  seleccionadoId.value = id
  estadoCaptura.value = 'idle'
  mensajeCaptura.value = ''
}

function cancelar() {
  window.huellero.cancelarEnrolamiento()
}

function cerrar() {
  window.huellero.cancelarEnrolamiento()
  emit('close')
}

async function iniciarCaptura() {
  if (!seleccionado.value) return
  if (!dedo.value) {
    estadoCaptura.value = 'error'
    mensajeCaptura.value = 'Elige el dedo a enrolar'
    return
  }

  estadoCaptura.value = 'capturando'
  mensajeCaptura.value = ''

  const res = await window.huellero.enrolarEstudiante({
    estudianteId: seleccionado.value._id,
    fichaId: ficha.value._id,
    dedo: dedo.value,
    nombre: `${seleccionado.value.nombres} ${seleccionado.value.apellidos}`.trim(),
  })

  if (res.ok) {
    estadoCaptura.value = 'ok'
    mensajeCaptura.value = 'Huella registrada correctamente'
  } else {
    estadoCaptura.value = 'error'
    mensajeCaptura.value = res.error || 'No se pudo registrar la huella'
  }
}
</script>

<template>
  <div class="overlay">
    <div class="modal">
      <header>
        <h2>Registrar huella</h2>
        <button class="ghost cerrar" @click="cerrar">✕</button>
      </header>

      <div v-if="cargando" class="cuerpo centrado">
        <p class="hint">Cargando ficha y estudiantes…</p>
      </div>

      <div v-else-if="errorInicial" class="cuerpo centrado">
        <p class="error">{{ errorInicial }}</p>
      </div>

      <template v-else>
        <div v-if="hayClaseActiva" class="aviso">
          Hay una clase activa en este dispositivo. Finalízala antes de enrolar huellas.
        </div>

        <div class="cuerpo">
          <div class="ficha-info">
            <span class="hint">Ficha</span>
            <strong>{{ ficha.codigoFicha }} · {{ ficha.nombrePrograma }}</strong>
          </div>

          <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar por nombre o documento"
            class="busqueda"
          />

          <ul class="lista">
            <li v-if="estudiantesFiltrados.length === 0" class="hint vacio">
              Sin resultados
            </li>
            <li
              v-for="e in estudiantesFiltrados"
              :key="e._id"
              :class="{ activo: e._id === seleccionadoId }"
              @click="seleccionar(e._id)"
            >
              <div>
                <strong>{{ e.nombres }} {{ e.apellidos }}</strong>
                <span class="hint">{{ e.tipoDocumento }} {{ e.numeroDocumento }}</span>
              </div>
              <span class="badge" :class="e.huellaEnrolada ? 'ok' : 'off'">
                {{ e.huellaEnrolada ? `Con huella${e.dedoEnrolado ? ' · ' + e.dedoEnrolado : ''}` : 'Sin huella' }}
              </span>
            </li>
          </ul>

          <div v-if="seleccionado" class="panel">
            <div class="panel-titulo">
              <strong>{{ seleccionado.nombres }} {{ seleccionado.apellidos }}</strong>
              <span class="hint">{{ seleccionado.numeroDocumento }}</span>
            </div>

            <label class="dedo">
              Dedo a enrolar
              <select v-model="dedo">
                <option value="" disabled>Selecciona un dedo</option>
                <option v-for="d in DEDOS" :key="d" :value="d">{{ d }}</option>
              </select>
            </label>

            <button
              class="primary"
              :disabled="estadoCaptura === 'capturando' || hayClaseActiva"
              @click="iniciarCaptura"
            >
              {{ estadoCaptura === 'capturando' ? 'Capturando…' : 'Iniciar captura' }}
            </button>

            <button v-if="estadoCaptura === 'capturando'" class="ghost" @click="cancelar">
              Cancelar
            </button>

            <p v-if="mensajeCaptura" class="mensaje" :class="estadoCaptura">
              {{ mensajeCaptura }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  width: 560px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-elev);
  border-radius: 16px;
  overflow: hidden;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #1e293b;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.cerrar {
  font-size: 16px;
}

.cuerpo {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.centrado {
  align-items: center;
  text-align: center;
  padding: 40px 20px;
}

.aviso {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warn);
  padding: 12px 20px;
  font-size: 14px;
}

.ficha-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.busqueda {
  width: 100%;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid #334155;
  border-radius: 10px;
}

.lista li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #1e293b;
}

.lista li:last-child {
  border-bottom: none;
}

.lista li.activo {
  background: rgba(34, 197, 94, 0.12);
}

.lista li > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vacio {
  padding: 16px;
  text-align: center;
}

.badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.ok {
  background: rgba(34, 197, 94, 0.15);
  color: var(--accent);
}

.badge.off {
  background: #334155;
  color: var(--muted);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px;
}

.panel-titulo {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dedo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--muted);
}

select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #334155;
  background: #0b1220;
  color: var(--text);
  font-size: 14px;
}

.mensaje {
  margin: 0;
  font-size: 14px;
}

.mensaje.ok {
  color: var(--accent);
}

.mensaje.error {
  color: var(--danger);
}

.mensaje.capturando {
  color: var(--muted);
}

.hint {
  color: var(--muted);
  font-size: 13px;
}

.error {
  color: var(--danger);
  font-size: 14px;
}
</style>
