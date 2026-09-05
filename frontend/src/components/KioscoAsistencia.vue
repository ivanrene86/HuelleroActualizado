<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { socket, unirseASalaFicha, salirDeSalaFicha, notificarMarcacionKiosco } from '../services/socket.js'
import api from '../services/api.js'

const props = defineProps({
  ficha: {
    type: Object,
    default: null,
  },
  instructor: {
    type: Object,
    default: () => ({ nombre: 'Instructor' }),
  },
  fecha: {
    type: String,
    default: () => new Date().toISOString().slice(0, 10),
  },
  standalone: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['salir-kiosco', 'asistencia-marcada'])

// Estado de la sesión remota y ficha dinámica
const sesionActiva = ref(false)
const sesionData = ref(null)
const fichaDinamica = ref(props.ficha || null)

const fichaActual = computed(() => {
  if (fichaDinamica.value) return fichaDinamica.value
  if (sesionData.value) {
    return {
      _id: sesionData.value.fichaId,
      codigoFicha: sesionData.value.fichaCodigo,
      nombrePrograma: sesionData.value.nombrePrograma,
      jornada: sesionData.value.jornada,
      aulaAsignada: sesionData.value.aulaAsignada || 'Ambiente Asignado',
    }
  }
  return null
})

// Datos de la ficha
const estudiantesFicha = ref([])
const asistenciasDia = ref({})
const marcacionesRecientes = ref([])

// Reloj en vivo
const horaActual = ref('')
const fechaFormateada = ref('')
let timerReloj = null

// SDK Biométrico
const lectorConectado = ref(false)
const capturando = ref(false)
const estadoLectorMsg = ref('Inicializando sensor USB...')
const procesandoHuella = ref(false)
let fpSdk = null
let currentReaderUid = ''
let currentFormat = null

// Última verificación en pantalla
const ultimaMarcacion = ref(null)
let timerLimpiarMarcacion = null

// Pantalla completa
const esPantallaCompleta = ref(false)

onMounted(async () => {
  actualizarHora()
  timerReloj = setInterval(actualizarHora, 1000)

  if (props.ficha?._id) {
    await cargarEstudiantesYAsistencias(props.ficha._id)
  }
  iniciarSocketKiosco()
  iniciarSDKBiometrico()
})

onUnmounted(() => {
  if (timerReloj) clearInterval(timerReloj)
  if (timerLimpiarMarcacion) clearTimeout(timerLimpiarMarcacion)
  detenerCapturaBiometrica()
  if (fichaActual.value?._id) {
    salirDeSalaFicha(fichaActual.value._id)
  }
  salirDeSalaFicha('global_kioscos')
})

function actualizarHora() {
  const ahora = new Date()
  horaActual.value = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  fechaFormateada.value = ahora.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// 1. Cargar estudiantes y asistencias previas de hoy
async function cargarEstudiantesYAsistencias(targetFichaId) {
  const idParaCargar = targetFichaId || fichaActual.value?._id
  if (!idParaCargar) return
  try {
    const [estRes, asisRes] = await Promise.all([
      api.estudiantes.getAll({ fichaId: idParaCargar }),
      api.asistencias.getAll({ fichaId: idParaCargar, fecha: props.fecha }),
    ])

    estudiantesFicha.value = Array.isArray(estRes) ? estRes : []
    const mapa = {}
    const listaRecientes = []

    if (Array.isArray(asisRes)) {
      asisRes.forEach((a) => {
        const estId = a.estudianteId?._id || a.estudianteId
        mapa[estId] = {
          estado: a.estado,
          hora: a.hora || '—',
        }
        if (a.estado === 'Presente' || a.estado === 'Tardanza') {
          const estObj = estudiantesFicha.value.find((e) => e._id === estId)
          if (estObj) {
            listaRecientes.unshift({
              id: estId,
              nombres: estObj.nombres,
              apellidos: estObj.apellidos,
              hora: a.hora || '—',
              estado: a.estado,
            })
          }
        }
      })
    }

    asistenciasDia.value = mapa
    marcacionesRecientes.value = listaRecientes.slice(0, 8)
  } catch (e) {
    console.error('[Kiosco] Error al cargar datos:', e)
  }
}

// 2. Conectar a Socket.IO para órdenes remotas
function iniciarSocketKiosco() {
  if (props.ficha?._id) {
    unirseASalaFicha(props.ficha._id, 'kiosco')
  }
  unirseASalaFicha('global_kioscos', 'kiosco')

  socket.on('estado_sesion', ({ activa, sesion }) => {
    sesionActiva.value = activa
    sesionData.value = sesion
    if (activa && sesion?.fichaId) {
      fichaDinamica.value = {
        _id: sesion.fichaId,
        codigoFicha: sesion.fichaCodigo,
        nombrePrograma: sesion.nombrePrograma,
        jornada: sesion.jornada,
        aulaAsignada: sesion.aulaAsignada || 'Ambiente Asignado',
      }
      cargarEstudiantesYAsistencias(sesion.fichaId)
      iniciarCapturaBiometrica()
    } else if (!activa) {
      detenerCapturaBiometrica()
    }
  })

  const onActivar = async (sesion) => {
    sesionActiva.value = true
    sesionData.value = sesion
    fichaDinamica.value = {
      _id: sesion.fichaId,
      codigoFicha: sesion.fichaCodigo,
      nombrePrograma: sesion.nombrePrograma,
      jornada: sesion.jornada,
      aulaAsignada: sesion.aulaAsignada || 'Ambiente Asignado',
    }
    await cargarEstudiantesYAsistencias(sesion.fichaId)
    iniciarCapturaBiometrica()
  }

  socket.on('kiosco:activar_lectura', onActivar)
  socket.on('kiosco:activar_lectura_global', onActivar)

  const onDesactivar = () => {
    sesionActiva.value = false
    detenerCapturaBiometrica()
    if (props.standalone) {
      fichaDinamica.value = null
      sesionData.value = null
    }
  }

  socket.on('kiosco:desactivar_lectura', onDesactivar)
  socket.on('kiosco:desactivar_lectura_global', onDesactivar)
}

// 3. Inicializar SDK de Huella DigitalPersona
function iniciarSDKBiometrico() {
  if (typeof Fingerprint === 'undefined') {
    estadoLectorMsg.value = 'Iniciando servicios...'
    setTimeout(iniciarSDKBiometrico, 1000)
    return
  }

  try {
    fpSdk = new Fingerprint.WebApi()
    currentFormat = Fingerprint.SampleFormat.PngImage

    fpSdk.onDeviceConnected = (e) => {
      if (e?.deviceUid) currentReaderUid = e.deviceUid
      lectorConectado.value = true
      estadoLectorMsg.value = 'Lector USB conectado'
      if (sesionActiva.value) iniciarCapturaBiometrica()
    }

    fpSdk.onDeviceDisconnected = () => {
      lectorConectado.value = false
      capturando.value = false
      estadoLectorMsg.value = 'Lector USB desconectado'
    }

    fpSdk.onSamplesAcquired = async (s) => {
      if (!s || !s.samples) return
      try {
        const samples = JSON.parse(s.samples)
        const sampleBase64 = Fingerprint.b64UrlTo64(samples[0])
        await procesarHuellaKiosco(sampleBase64)
      } catch (err) {
        console.error('[Kiosco] Error al procesar huella:', err)
      }
    }

    fpSdk.enumerateDevices().then(
      (readers) => {
        if (readers && readers.length > 0) {
          currentReaderUid = readers[0]
          lectorConectado.value = true
          estadoLectorMsg.value = 'Sensor DigitalPersona Listo'
          if (sesionActiva.value) iniciarCapturaBiometrica()
        } else {
          lectorConectado.value = false
          estadoLectorMsg.value = 'Conecte el sensor USB'
        }
      },
      () => {
        lectorConectado.value = false
        estadoLectorMsg.value = 'Servicio local no detectado'
      }
    )
  } catch (err) {
    console.error('[Kiosco] Error al inicializar SDK:', err)
    estadoLectorMsg.value = 'Error de sensor'
  }
}

function iniciarCapturaBiometrica() {
  if (!fpSdk || !lectorConectado.value || capturando.value) return
  fpSdk.startAcquisition(currentFormat, currentReaderUid).then(
    () => { capturando.value = true },
    (err) => console.error('[Kiosco] Error al iniciar captura:', err)
  )
}

function detenerCapturaBiometrica() {
  if (!fpSdk || !capturando.value) return
  fpSdk.stopAcquisition().then(
    () => { capturando.value = false },
    (err) => console.warn('[Kiosco] Error al detener captura:', err)
  )
}

// 4. Procesar la huella leída
async function procesarHuellaKiosco(imageBase64) {
  if (procesandoHuella.value) return
  procesandoHuella.value = true

  try {
    const fichaId = fichaActual.value?._id
    if (!fichaId) return

    const result = await api.estudiantes.fingerprint.verify(imageBase64, fichaId)

    const ahora = new Date()
    const horaStr = ahora.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })

    if (result.match) {
      const estId = result.studentId
      const nombreCompleto = `${result.nombres} ${result.apellidos}`
      const registroPrevio = asistenciasDia.value[estId]

      const jornada = fichaActual.value?.jornada || 'Mañana'
      const esTardanza = calcularTardanza(jornada, ahora)
      const estadoMarcado = esTardanza ? 'Tardanza' : 'Presente'

      if (registroPrevio && (registroPrevio.estado === 'Presente' || registroPrevio.estado === 'Tardanza')) {
        mostrarResultadoMarcacion({
          tipo: 'ya_registrado',
          nombreCompleto,
          hora: registroPrevio.hora || horaStr,
          estado: registroPrevio.estado,
        })
      } else {
        await api.asistencias.create({
          estudianteId: estId,
          fichaId: fichaId,
          fecha: props.fecha,
          estado: estadoMarcado,
          hora: horaStr,
          instructorId: props.instructor?.id || null,
        })

        asistenciasDia.value[estId] = {
          estado: estadoMarcado,
          hora: horaStr,
        }

        const datosNotificacion = {
          fichaId,
          estudianteId: estId,
          nombres: result.nombres,
          apellidos: result.apellidos,
          hora: horaStr,
          estado: estadoMarcado,
        }

        notificarMarcacionKiosco(datosNotificacion)
        emit('asistencia-marcada', datosNotificacion)

        mostrarResultadoMarcacion({
          tipo: 'exito',
          nombreCompleto,
          hora: horaStr,
          estado: estadoMarcado,
        })
      }
    } else {
      mostrarResultadoMarcacion({
        tipo: 'no_reconocida',
        nombreCompleto: '',
      })
    }
  } catch (err) {
    console.error('[Kiosco] Error al verificar huella:', err)
  } finally {
    procesandoHuella.value = false
  }
}

function calcularTardanza(jornada, ahora) {
  const horas = ahora.getHours()
  const minutos = ahora.getMinutes()
  const totalMinutos = horas * 60 + minutos

  // Jornadas estándar SENA (Tolerancia 15 minutos):
  if (jornada === 'Mañana' && totalMinutos > 6 * 60 + 15) return true
  if (jornada === 'Tarde' && totalMinutos > 12 * 60 + 15) return true
  if (jornada === 'Noche' && totalMinutos > 18 * 60 + 15) return true
  return false
}

function mostrarResultadoMarcacion(resultado) {
  if (timerLimpiarMarcacion) clearTimeout(timerLimpiarMarcacion)
  ultimaMarcacion.value = resultado

  timerLimpiarMarcacion = setTimeout(() => {
    ultimaMarcacion.value = null
  }, 3500)
}

function togglePantallaCompleta() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => console.log(err))
    esPantallaCompleta.value = true
  } else {
    document.exitFullscreen().catch((err) => console.log(err))
    esPantallaCompleta.value = false
  }
}
</script>

<template>
  <div class="kiosco-minimal" :class="{ 'pantalla-completa': esPantallaCompleta }">
    <!-- ENCABEZADO MINIMALISTA -->
    <header class="minimal-header">
      <div class="header-left">
        <div class="sena-tag">
          <span class="sena-dot"></span>
          <span class="sena-name">SENA</span>
        </div>

        <div class="class-info">
          <h1 class="class-title">
            {{ fichaActual ? fichaActual.nombrePrograma : 'Terminal de Asistencia' }}
          </h1>
          <div v-if="fichaActual" class="class-badges">
            <span class="badge-item">Ficha {{ fichaActual.codigoFicha }}</span>
            <span class="badge-separator">•</span>
            <span class="badge-item">{{ fichaActual.jornada }}</span>
            <span class="badge-separator">•</span>
            <span class="badge-item">{{ fichaActual.aulaAsignada || 'Ambiente Asignado' }}</span>
          </div>
          <div v-else class="class-badges">
            <span class="badge-item">Receptor de Aula</span>
            <span class="badge-separator">•</span>
            <span class="badge-item">Modo Espera</span>
          </div>
        </div>
      </div>

      <div class="header-right">
        <div class="clock-box">
          <div class="clock-display">{{ horaActual }}</div>
          <div class="date-display">{{ fechaFormateada }}</div>
        </div>

        <div class="header-buttons">
          <button class="btn-clean" @click="togglePantallaCompleta" :title="esPantallaCompleta ? 'Restaurar' : 'Pantalla Completa'">
            <svg v-if="!esPantallaCompleta" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
            <span>{{ esPantallaCompleta ? 'Salir' : 'Ampliar' }}</span>
          </button>

          <button class="btn-clean btn-exit" @click="$emit('salir-kiosco')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>{{ standalone ? 'Cerrar' : 'Volver' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- BARRA DE ESTADO SUTIL -->
    <div class="status-strip">
      <div class="status-indicator">
        <span class="indicator-dot" :class="sesionActiva ? 'dot-active' : 'dot-standby'"></span>
        <span class="indicator-label">
          {{ sesionActiva ? 'Pase de lista en curso' : 'Esperando activación del docente' }}
        </span>
      </div>

      <div class="hardware-label">
        <span class="hw-status-dot" :class="lectorConectado ? 'hw-on' : 'hw-off'"></span>
        <span>{{ estadoLectorMsg }}</span>
      </div>
    </div>

    <!-- CUERPO PRINCIPAL MINIMALISTA -->
    <main class="minimal-stage">
      <!-- MODO 1: ESPERA (Sin ficha asignada) -->
      <div v-if="!fichaActual" class="standby-wrapper">
        <div class="standby-card">
          <div class="standby-icon-box">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
          </div>
          <h2 class="standby-headline">Terminal Conectado</h2>
          <p class="standby-subline">
            El docente activará la sesión de clase desde su panel.
            La pantalla se configurará automáticamente para el pase de lista.
          </p>
          <div class="standby-tags">
            <span class="status-pill-clean" :class="lectorConectado ? 'pill-ready' : 'pill-wait'">
              {{ lectorConectado ? '✓ Sensor USB Listo' : 'Conecte Sensor USB' }}
            </span>
            <span class="status-pill-clean pill-ready">
              ✓ Red en Tiempo Real
            </span>
          </div>
        </div>
      </div>

      <!-- MODO 2: FICHA ACTIVA -->
      <div v-else class="scanner-wrapper">
        <transition name="clean-fade" mode="out-in">
          <!-- CARD DE CONFIRMACIÓN (RESULTADO) -->
          <div
            v-if="ultimaMarcacion"
            :key="ultimaMarcacion.nombreCompleto + ultimaMarcacion.tipo"
            class="confirmation-card"
            :class="`theme-${ultimaMarcacion.tipo}`"
          >
            <div class="confirmation-icon">
              <!-- Éxito -->
              <svg v-if="ultimaMarcacion.tipo === 'exito'" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <!-- Ya registrado -->
              <svg v-else-if="ultimaMarcacion.tipo === 'ya_registrado'" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <!-- No reconocida -->
              <svg v-else viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            </div>

            <div class="confirmation-body">
              <div v-if="ultimaMarcacion.tipo === 'exito'">
                <div class="result-kicker">ASISTENCIA CONFIRMADA</div>
                <h2 class="result-name">{{ ultimaMarcacion.nombreCompleto }}</h2>
                <div class="result-badge" :class="ultimaMarcacion.estado === 'Tardanza' ? 'badge-tardanza' : 'badge-presente'">
                  <span>{{ ultimaMarcacion.estado === 'Tardanza' ? 'Tardanza' : 'Presente' }}</span>
                  <span class="badge-divider">•</span>
                  <span>{{ ultimaMarcacion.hora }}</span>
                </div>
              </div>

              <div v-else-if="ultimaMarcacion.tipo === 'ya_registrado'">
                <div class="result-kicker kicker-muted">REGISTRO PREVIO</div>
                <h2 class="result-name">{{ ultimaMarcacion.nombreCompleto }}</h2>
                <p class="result-desc">Tu asistencia ya fue confirmada hoy a las {{ ultimaMarcacion.hora }}.</p>
              </div>

              <div v-else>
                <div class="result-kicker kicker-warn">LECTURA NO RECONOCIDA</div>
                <h2 class="result-name">Huella no identificada</h2>
                <p class="result-desc">Apoye la yema del dedo con firmeza sobre el sensor e intente de nuevo.</p>
              </div>
            </div>
          </div>

          <!-- SCANNER BIOMÉTRICO MINIMALISTA -->
          <div
            v-else
            class="sensor-stage"
            :class="{ 'sensor-active': sesionActiva && capturando, 'sensor-busy': procesandoHuella, 'sensor-idle': !sesionActiva }"
          >
            <div class="sensor-pad">
              <div class="laser-line" :class="{ 'laser-active': sesionActiva && capturando, 'laser-busy': procesandoHuella }"></div>
              
              <!-- VECTOR DE HUELLA MINIMALISTA -->
              <svg class="sensor-fingerprint" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M12 11c0-1.66-1.34-3-3-3s-3 1.34-3 3c0 2.5 1.5 4.5 3 6.5" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M12 11c0-2.76 2.24-5 5-5s5 2.24 5 5c0 5-2.5 8-5 10" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M8.5 7.5c1-1 2.2-1.5 3.5-1.5s2.5.5 3.5 1.5" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M5 12c0-3.87 3.13-7 7-7s7 3.13 7 7c0 3-.9 5.5-2.3 7.5" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M3 13c0-4.97 4.03-9 9-9s9 4.03 9 9c0 3.5-1.2 6.5-3 9" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M12 14c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1s1-.45 1-1v-2" />
              </svg>

              <!-- MARCADORES DE ESQUINA LIMPIOS -->
              <div class="corner-mark cm-tl"></div>
              <div class="corner-mark cm-tr"></div>
              <div class="corner-mark cm-bl"></div>
              <div class="corner-mark cm-br"></div>
            </div>

            <div class="sensor-prompt-box">
              <h2 v-if="procesandoHuella" class="prompt-title prompt-pulsing">
                Verificando...
              </h2>
              <h2 v-else-if="sesionActiva && capturando" class="prompt-title">
                Coloque su huella en el lector
              </h2>
              <h2 v-else class="prompt-title prompt-muted">
                Pase de lista no iniciado
              </h2>

              <p class="prompt-help">
                {{
                  sesionActiva
                    ? 'Apoye firmemente la yema del dedo sobre el sensor USB.'
                    : 'El docente activará la sesión en el aula.'
                }}
              </p>
            </div>
          </div>
        </transition>
      </div>
    </main>

    <!-- PIE DISCRETO Y MINIMALISTA -->
    <footer class="minimal-footer">
      <div class="footer-segment">
        <span class="footer-dot"></span>
        <span>Validación Biométrica Local</span>
      </div>
      <div class="footer-segment">
        <span>DigitalPersona U.are.U 4500</span>
      </div>
      <div class="footer-segment">
        <span>SENA • Centro de Formación</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ========================================================= */
/* DISEÑO MINIMALISTA Y SOFISTICADO (ESTILO LINEAR / VERCEL) */
/* ========================================================= */

.kiosco-minimal {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background-color: #09090b; /* Zinc 950 muy profundo y sobrio */
  color: #fafafa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}

/* ENCABEZADO MINIMALISTA */
.minimal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 36px;
  background: rgba(15, 15, 18, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 18px;
}

.sena-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 14px;
  border-radius: 8px;
}

.sena-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #39a900; /* Verde institucional SENA como único toque de color */
  box-shadow: 0 0 8px rgba(57, 169, 0, 0.6);
}

.sena-name {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #ffffff;
}

.class-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.class-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #f4f4f5;
  letter-spacing: -0.3px;
}

.class-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a1a1aa;
}

.badge-item {
  color: #a1a1aa;
}

.badge-separator {
  color: #52525b;
  font-size: 10px;
}

/* HEADER DERECHA */
.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.clock-box {
  text-align: right;
}

.clock-display {
  font-size: 22px;
  font-weight: 700;
  color: #fafafa;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.date-display {
  font-size: 11px;
  color: #71717a;
  text-transform: capitalize;
}

.header-buttons {
  display: flex;
  gap: 8px;
}

.btn-clean {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #18181b;
  color: #d4d4d8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-clean:hover {
  background: #27272a;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-exit:hover {
  background: #27272a;
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

/* BARRA DE ESTADO */
.status-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 36px;
  background: #0f0f12;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: #a1a1aa;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot-active {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.dot-standby {
  background: #eab308;
}

.indicator-label {
  font-weight: 500;
  color: #d4d4d8;
}

.hardware-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #71717a;
  font-size: 11px;
}

.hw-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.hw-on {
  background: #22c55e;
}

.hw-off {
  background: #ef4444;
}

/* CUERPO PRINCIPAL */
.minimal-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.standby-wrapper,
.scanner-wrapper {
  width: 100%;
  max-width: 640px;
  display: flex;
  justify-content: center;
}

/* CARD DE ESPERA */
.standby-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #121215;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 48px 40px;
  width: 100%;
}

.standby-icon-box {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a1a1aa;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.standby-headline {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: #fafafa;
}

.standby-subline {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #71717a;
  line-height: 1.5;
  max-width: 440px;
}

.standby-tags {
  display: flex;
  gap: 10px;
}

.status-pill-clean {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a1a1aa;
}

.pill-ready {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.06);
}

.pill-wait {
  color: #fde047;
  border-color: rgba(234, 179, 8, 0.25);
}

/* SENSOR STAGE (MINIMALISTA) */
.sensor-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #121215;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 56px 48px;
  width: 100%;
  transition: all 0.25s ease;
}

.sensor-pad {
  position: relative;
  width: 160px;
  height: 200px;
  border-radius: 24px;
  background: #09090b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  overflow: hidden;
  transition: all 0.25s ease;
}

.sensor-active .sensor-pad {
  border-color: #39a900;
  box-shadow: 0 0 25px rgba(57, 169, 0, 0.15);
}

.sensor-busy .sensor-pad {
  border-color: #ffffff;
  box-shadow: 0 0 25px rgba(255, 255, 255, 0.15);
}

.laser-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #39a900;
  box-shadow: 0 0 10px #39a900;
  top: 0;
  opacity: 0;
  z-index: 2;
}

.laser-active {
  opacity: 1;
  animation: cleanLaser 2.2s infinite ease-in-out;
}

.laser-busy {
  opacity: 1;
  background: #ffffff;
  box-shadow: 0 0 12px #ffffff;
  animation: cleanLaser 0.7s infinite ease-in-out;
}

@keyframes cleanLaser {
  0% { top: 6%; opacity: 0.4; }
  50% { top: 92%; opacity: 1; }
  100% { top: 6%; opacity: 0.4; }
}

.sensor-fingerprint {
  width: 100px;
  height: 100px;
  color: #3f3f46;
  transition: all 0.25s ease;
}

.sensor-active .sensor-fingerprint {
  color: #39a900;
}

.sensor-busy .sensor-fingerprint {
  color: #fafafa;
  transform: scale(1.03);
}

/* MARCADORES DE ESQUINA */
.corner-mark {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: rgba(255, 255, 255, 0.15);
}

.sensor-active .corner-mark {
  border-color: #39a900;
}

.cm-tl { top: 10px; left: 10px; border-top: 1.5px solid; border-left: 1.5px solid; }
.cm-tr { top: 10px; right: 10px; border-top: 1.5px solid; border-right: 1.5px solid; }
.cm-bl { bottom: 10px; left: 10px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.cm-br { bottom: 10px; right: 10px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

/* TEXTOS DEL SENSOR */
.prompt-title {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 700;
  color: #fafafa;
  letter-spacing: -0.3px;
}

.prompt-help {
  margin: 0;
  font-size: 13px;
  color: #71717a;
}

.prompt-pulsing {
  color: #ffffff;
  animation: textPulse 1s infinite;
}

@keyframes textPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.prompt-muted {
  color: #71717a;
}

/* CARD DE CONFIRMACIÓN (RESULTADO) */
.confirmation-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: #121215;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 48px 40px;
  width: 100%;
}

.theme-exito {
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.05) 0%, #121215 100%);
}

.theme-ya_registrado {
  border-color: rgba(255, 255, 255, 0.2);
}

.theme-no_reconocida {
  border-color: rgba(245, 158, 11, 0.4);
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, #121215 100%);
}

.confirmation-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  background: #18181b;
}

.theme-exito .confirmation-icon {
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.theme-ya_registrado .confirmation-icon {
  color: #a1a1aa;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.theme-no_reconocida .confirmation-icon {
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.result-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #22c55e;
  margin-bottom: 6px;
}

.kicker-muted {
  color: #a1a1aa;
}

.kicker-warn {
  color: #f59e0b;
}

.result-name {
  margin: 0 0 16px 0;
  font-size: 30px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.4px;
}

.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.badge-presente {
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.badge-tardanza {
  background: rgba(245, 158, 11, 0.12);
  color: #fde047;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.badge-divider {
  opacity: 0.5;
}

.result-desc {
  margin: 0;
  font-size: 14px;
  color: #a1a1aa;
}

/* PIE MINIMALISTA */
.minimal-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 28px;
  padding: 14px 36px;
  background: #09090b;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #52525b;
}

.footer-segment {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #39a900;
}

/* TRANSICIONES LIMPIAS */
.clean-fade-enter-active,
.clean-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.clean-fade-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.clean-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

/* RESPONSIVE */
@media (max-width: 800px) {
  .minimal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .header-right {
    width: 100%;
    justify-content: space-between;
  }
  .minimal-footer {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
