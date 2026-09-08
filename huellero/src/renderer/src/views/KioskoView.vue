<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  status: { type: Object, required: true },
})

const emit = defineEmits(['abrir-login'])

const estado = ref('idle')
const resultado = ref(null)

const online = computed(() => props.status.online)
const claseActiva = computed(() => props.status.claseActiva)
const dispositivoRegistrado = computed(() => !!props.status.dispositivoRegistrado)

const aviso = ref('')
let avisoTimer = null

watch(
  () => props.status.avisoSesion,
  (val) => {
    if (!val) return
    aviso.value = val
    if (avisoTimer) clearTimeout(avisoTimer)
    avisoTimer = setTimeout(() => {
      aviso.value = ''
    }, 5000)
  },
  { immediate: true }
)

function onKeydown(e) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
    emit('abrir-login')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (avisoTimer) clearTimeout(avisoTimer)
})

async function leerHuella() {
  if (estado.value === 'leyendo') return
  estado.value = 'leyendo'
  resultado.value = null

  try {
    const res = await window.huellero.capturarYVerificar()
    if (res.match) {
      if (res.duplicado) {
        resultado.value = { tipo: 'dup', texto: `${res.nombres} ${res.apellidos}` }
      } else {
        resultado.value = { tipo: 'ok', texto: `${res.nombres} ${res.apellidos}` }
      }
    } else {
      resultado.value = { tipo: 'error', texto: res.error || 'Huella no reconocida' }
    }
  } catch (err) {
    resultado.value = { tipo: 'error', texto: 'No se pudo procesar la huella' }
  } finally {
    estado.value = 'idle'
  }
}
</script>

<template>
  <div class="kiosko">
    <div v-if="aviso" class="aviso-sesion">{{ aviso }}</div>

    <div class="status-bar">
      <span class="pill" :class="online ? 'ok' : 'off'">
        {{ online ? 'En línea' : 'Sin conexión' }}
      </span>
      <span class="pill" :class="claseActiva ? 'ok' : 'warn'">
        {{ claseActiva ? `Clase activa · Ficha ${claseActiva.fichaId}` : 'Sin clase activa' }}
      </span>
      <span v-if="!dispositivoRegistrado" class="pill info">
        Equipo no identificado. Reintentando conexión…
      </span>
    </div>

    <main class="lector">
      <div class="fingerprint-icon" :class="{ pulse: estado === 'leyendo' }">☝</div>
      <h1>{{ claseActiva ? 'Coloca tu dedo para marcar asistencia' : 'No hay clase activa' }}</h1>
      <p class="hint">Apoya el dedo en el lector DigitalPersona</p>

      <button class="primary leer" :disabled="estado === 'leyendo'" @click="leerHuella">
        {{ estado === 'leyendo' ? 'Leyendo…' : 'Leer huella' }}
      </button>

      <div v-if="resultado" class="resultado" :class="resultado.tipo">
        <template v-if="resultado.tipo === 'ok'">
          <strong>Asistencia registrada</strong>
          <span>{{ resultado.texto }}</span>
        </template>
        <template v-else-if="resultado.tipo === 'dup'">
          <strong>Ya registraste tu asistencia</strong>
          <span>{{ resultado.texto }}</span>
        </template>
        <template v-else>
          <strong>No se pudo registrar</strong>
          <span>{{ resultado.texto }}</span>
        </template>
      </div>
    </main>

    <button class="ghost acceso" title="Acceso docente" @click="emit('abrir-login')">⚙</button>
  </div>
</template>

<style scoped>
.kiosko {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.status-bar {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
}

.pill {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
}

.pill.ok {
  background: rgba(34, 197, 94, 0.15);
  color: var(--accent);
}

.pill.off {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.pill.warn {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warn);
}

.pill.info {
  background: #334155;
  color: var(--muted);
}

.lector {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  padding: 0 24px;
}

.fingerprint-icon {
  font-size: 96px;
  line-height: 1;
  opacity: 0.9;
}

.fingerprint-icon.pulse {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.08); opacity: 1; }
}

h1 {
  margin: 0;
  font-size: 26px;
}

.hint {
  margin: 0 0 10px;
  color: var(--muted);
}

.leer {
  min-width: 200px;
  padding: 16px 32px;
  font-size: 17px;
}

.resultado {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 15px;
}

.resultado.ok {
  background: rgba(34, 197, 94, 0.12);
  color: var(--accent);
}

.resultado.dup {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warn);
}

.resultado.error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

.acceso {
  position: absolute;
  bottom: 14px;
  right: 14px;
  font-size: 18px;
  opacity: 0.4;
}

.acceso:hover {
  opacity: 1;
}

.aviso-sesion {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 158, 11, 0.18);
  color: var(--warn);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  z-index: 60;
  white-space: nowrap;
}
</style>
