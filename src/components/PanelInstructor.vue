<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '../services/api.js'
import * as XLSX from 'xlsx'

const usuarioStr = sessionStorage.getItem('user_data')
const usuario = ref(usuarioStr ? JSON.parse(usuarioStr) : { id: '', nombre: 'Instructor', rol: 'Instructor' })

const misFichas = ref([])
const fichaSeleccionada = ref(null)
const estudiantesFicha = ref([])
const excusasFicha = ref([])
const asistenciasFicha = ref([])
const loading = ref(true)
const error = ref('')
const vistaFicha = ref('asistencia')

const emit = defineEmits(['cerrar-sesion'])

// Toast notifications
const toast = reactive({ show: false, message: '', type: 'success' })
function showToast(message, type = 'success') {
  toast.show = true
  toast.message = message
  toast.type = type
  setTimeout(() => { toast.show = false }, 3000)
}

function cerrarSesion() {
  sessionStorage.removeItem('admin_auth')
  sessionStorage.removeItem('user_data')
  emit('cerrar-sesion')
}

onMounted(async () => {
  await cargarMisFichas()
  setTimeout(() => initFingerprintSDK(), 500)
})

async function cargarMisFichas() {
  loading.value = true
  error.value = ''
  try {
    if (usuario.value.id) {
      misFichas.value = await api.fichas.getMisFichas(usuario.value.id)
      if (misFichas.value.length > 0) {
        seleccionarFicha(misFichas.value[0])
      }
    } else {
      misFichas.value = await api.fichas.getAll()
    }
  } catch (err) {
    error.value = err.message || 'Error al cargar las fichas asignadas'
  } finally {
    loading.value = false
  }
}

async function seleccionarFicha(ficha) {
  fichaSeleccionada.value = ficha
  vistaFicha.value = 'asistencia'
  await cargarDatosFicha(ficha._id)
}

// Auto-activar lectura biométrica al entrar en la vista de asistencia
watch(vistaFicha, (nuevaVista, viejaVista) => {
  if (nuevaVista === 'asistencia' && lectorConectado.value && fpSdk) {
    // Activar modo asistencia
    modoCaptura = 'asistencia'
    verificandoHuella.value = true
    ultimaVerificacion.value = null
    if (!capturing) {
      setTimeout(() => iniciarCapturaSDK(), 300)
    }
  } else if (viejaVista === 'asistencia' && nuevaVista !== 'asistencia') {
    // Saliendo de asistencia: detener
    detenerVerificacionHuella()
  }
})

const memoriaBiometricaRAM = ref([])

async function cargarDatosFicha(fichaId) {
  try {
    const estRes = await api.estudiantes.getAll({ fichaId }).catch(e => { console.error('Error est:', e); return [] })
    const asisRes = await api.asistencias.getAll({ fichaId }).catch(e => { console.error('Error asis:', e); return [] })
    const bioRes = await api.fichas.getPlantillasBiometricas(fichaId).catch(e => { console.error('Error bio:', e); return [] })

    estudiantesFicha.value = Array.isArray(estRes) ? estRes : []
    asistenciasFicha.value = Array.isArray(asisRes) ? asisRes : []
    memoriaBiometricaRAM.value = Array.isArray(bioRes) ? bioRes : []
    inicializarAsistenciaDia()
  } catch (err) {
    console.error('Error al cargar detalle de ficha:', err)
  }
}

// =============================================
// TOMA DE ASISTENCIA CON CHECKBOX DE EXCUSA
// =============================================
const asistenciaDia = ref({})
const guardandoAsistencia = ref(false)
const fechaAsistencia = ref(new Date().toISOString().split('T')[0])

function inicializarAsistenciaDia() {
  const hoy = fechaAsistencia.value
  const registros = {}
  for (const est of estudiantesFicha.value) {
    const existente = asistenciasFicha.value.find(
      a => a.estudianteId === est._id && a.fecha === hoy
    )
    registros[est._id] = {
      estado: existente ? existente.estado : 'Ninguno',
      excusa: existente ? existente.estado === 'Excusada' : false,
      horaMarcacion: existente ? (existente.hora || '') : '',
    }
  }
  asistenciaDia.value = registros
}

function calcularEstadoPorHora(jornada) {
  const ahora = new Date()
  const hora = ahora.getHours()
  const minuto = ahora.getMinutes()
  const minutosTotales = hora * 60 + minuto

  // Tolerancia de 15 minutos según jornada:
  // Mañana: 7:00 AM (420 min) -> Tolerancia hasta 7:15 AM (435 min)
  // Tarde: 1:00 PM (13:00 = 780 min) -> Tolerancia hasta 1:15 PM (795 min)
  // Noche: 6:00 PM (18:00 = 1080 min) -> Tolerancia hasta 6:15 PM (1095 min)

  let limiteTolerancia = 435 // 7:15 AM por defecto
  if (jornada === 'Tarde') {
    limiteTolerancia = 795 // 1:15 PM
  } else if (jornada === 'Noche') {
    limiteTolerancia = 1095 // 6:15 PM
  }

  return minutosTotales > limiteTolerancia ? 'Tardanza' : 'Presente'
}

function marcarPresente(estId) {
  const reg = asistenciaDia.value[estId]
  if (!reg) return

  if (reg.estado === 'Presente' || reg.estado === 'Tardanza') {
    // Desmarcar al hacer clic de nuevo
    reg.estado = 'Ninguno'
    reg.horaMarcacion = ''
  } else {
    const ahora = new Date()
    const horaFormateada = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const jornadaFicha = fichaSeleccionada.value?.jornada || 'Mañana'
    const estadoCalculado = calcularEstadoPorHora(jornadaFicha)

    reg.estado = estadoCalculado
    reg.horaMarcacion = horaFormateada
    reg.excusa = false
  }
}

function toggleExcusa(estId) {
  const reg = asistenciaDia.value[estId]
  if (reg) {
    reg.excusa = !reg.excusa
    if (reg.excusa) {
      reg.estado = 'Excusada'
    } else {
      reg.estado = 'Ninguno'
      reg.horaMarcacion = ''
    }
  }
}

async function guardarAsistenciaDia() {
  guardandoAsistencia.value = true
  const hoy = fechaAsistencia.value
  const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  let exitosos = 0
  let errores = 0

  for (const est of estudiantesFicha.value) {
    const reg = asistenciaDia.value[est._id]
    let estadoFinal = 'Falta' // Falla automática por defecto para quien no asistió
    let horaMarcada = horaActual

    if (reg) {
      if (reg.excusa) {
        estadoFinal = 'Excusada'
        horaMarcada = reg.horaMarcacion || horaActual
      } else if (['Presente', 'Tardanza', 'Excusada'].includes(reg.estado)) {
        estadoFinal = reg.estado
        horaMarcada = reg.horaMarcacion || horaActual
      }
    }

    try {
      await api.asistencias.create({
        estudianteId: est._id,
        fichaId: fichaSeleccionada.value._id,
        estado: estadoFinal,
        fecha: hoy,
        hora: horaMarcada,
      })
      exitosos++
    } catch (err) {
      errores++
      console.error(`Error asistencia ${est.nombres}:`, err.message)
    }
  }

  await cargarDatosFicha(fichaSeleccionada.value._id)
  guardandoAsistencia.value = false

  if (errores === 0) {
    showToast(`✅ Jornada finalizada. Asistencias, tardanzas por horario y fallas guardadas.`)
  } else {
    showToast(`⚠️ ${exitosos} guardados, ${errores} con error`, 'warning')
  }
}

// Contadores de asistencia del día
const conteoAsistencia = computed(() => {
  const conteo = { Presente: 0, Tardanza: 0, Falta: 0, Excusada: 0 }
  for (const est of estudiantesFicha.value) {
    const reg = asistenciaDia.value[est._id]
    if (reg) {
      const estado = reg.excusa ? 'Excusada' : reg.estado
      if (['Presente', 'Tardanza', 'Excusada'].includes(estado)) {
        conteo[estado]++
      } else {
        conteo.Falta++ // Los no marcados cuentan como Falta automática
      }
    } else {
      conteo.Falta++
    }
  }
  return conteo
})

// =============================================
// GESTIÓN DE EXCUSAS
// =============================================
async function aprobarExcusa(excusaId) {
  try {
    await api.excusas.aprobar(excusaId)
    await cargarDatosFicha(fichaSeleccionada.value._id)
    showToast('Excusa aprobada correctamente')
  } catch (err) {
    showToast('Error al aprobar excusa: ' + err.message, 'error')
  }
}

const showRechazoModal = ref(false)
const excusaArechazar = ref(null)
const motivoRechazo = ref('')

function abrirRechazo(excusaId) {
  excusaArechazar.value = excusaId
  motivoRechazo.value = ''
  showRechazoModal.value = true
}

async function confirmarRechazo() {
  if (!motivoRechazo.value.trim()) {
    showToast('Ingresa el motivo del rechazo', 'error')
    return
  }
  try {
    await api.excusas.rechazar(excusaArechazar.value, motivoRechazo.value)
    await cargarDatosFicha(fichaSeleccionada.value._id)
    showRechazoModal.value = false
    showToast('Excusa rechazada')
  } catch (err) {
    showToast('Error al rechazar excusa: ' + err.message, 'error')
  }
}

// =============================================
// SEMÁFORO DE ESTADO (WS SERVIDORES + LECTORES USB)
// =============================================
const wsConectado = ref(false)
const sdkBackendActivo = ref(false)
const lectorConectado = ref(false)
const sdkCargando = ref(true)
const estadoLector = ref('Verificando Lector USB...')

let fpSdk = null
let currentReaderUid = ''
let capturing = false
let sdkInitIntentos = 0
let currentFormat = null
let modoCaptura = 'enrolamiento' // 'enrolamiento' o 'asistencia'

// Estado de verificación biométrica para asistencia
const verificandoHuella = ref(false)
const ultimaVerificacion = ref(null)

async function verificarConexionServidor() {
  try {
    const res = await api.estudiantes.fingerprint.status()
    wsConectado.value = true
    sdkBackendActivo.value = !!(res && res.sdkAvailable)
  } catch (err) {
    wsConectado.value = false
    sdkBackendActivo.value = false
  }
}

function verificarEstadoLectorUSB() {
  if (!fpSdk || capturing || enrolando.value) return // No consultar durante captura o enrolamiento para no interrumpir la transmisión de datos

  fpSdk.enumerateDevices().then(function (readers) {
    sdkCargando.value = false
    if (readers && readers.length > 0) {
      currentReaderUid = readers[0]
      lectorConectado.value = true
      estadoLector.value = `Lector USB Conectado (${readers.length} dispositivo detectado)`
    } else {
      currentReaderUid = ''
      lectorConectado.value = false
      estadoLector.value = 'Sin lector de huellas USB'
    }
  }, function (error) {
    sdkCargando.value = false
    lectorConectado.value = false
    currentReaderUid = ''
    estadoLector.value = 'Servicio local de huellas no responde'
  })
}

function initFingerprintSDK() {
  sdkInitIntentos++
  console.log('[FP SDK] Intento', sdkInitIntentos, '- verificando Fingerprint global...')

  if (typeof Fingerprint === 'undefined') {
    console.warn('[FP SDK] Fingerprint global no definido aun.')
    sdkCargando.value = true
    estadoLector.value = 'SDK no cargado - scripts faltantes'
    if (sdkInitIntentos < 10) {
      setTimeout(initFingerprintSDK, 1000)
    } else {
      sdkCargando.value = false
      lectorConectado.value = false
      estadoLector.value = 'SDK no disponible tras varios intentos'
    }
    return
  }

  console.log('[FP SDK] Fingerprint global OK, creando WebApi...')
  try {
    fpSdk = new Fingerprint.WebApi()
    console.log('[FP SDK] WebApi creado:', fpSdk)
  } catch (e) {
    console.error('[FP SDK] Error al crear WebApi:', e.message)
    sdkCargando.value = false
    lectorConectado.value = false
    estadoLector.value = 'Error al inicializar SDK: ' + e.message
    return
  }

  fpSdk.onDeviceConnected = function (e) {
    console.log('[FP SDK] Dispositivo conectado:', e)
    if (e && e.deviceUid) currentReaderUid = e.deviceUid
    lectorConectado.value = true
    sdkCargando.value = false
    estadoLector.value = 'Lector conectado - U.are.U 4500'
  }

  fpSdk.onDeviceDisconnected = function (e) {
    console.log('[FP SDK] Dispositivo desconectado:', e)
    lectorConectado.value = false
    currentReaderUid = ''
    estadoLector.value = 'Lector desconectado'
  }

  fpSdk.onCommunicationFailed = function (e) {
    console.error('[FP SDK] Error de comunicacion:', e)
    estadoLector.value = 'Error de comunicacion con el lector'
    lectorConectado.value = false
    sdkCargando.value = false
  }

  fpSdk.onSamplesAcquired = function (s) {
    console.log('[FP SDK] Muestra adquirida, modo:', modoCaptura)
    detenerCapturaSDK()
    try {
      const samples = JSON.parse(s.samples)
      if (!samples || samples.length === 0) {
        console.warn('[FP SDK] No hay samples en la respuesta')
        return
      }
      const imgSrc = 'data:image/png;base64,' + Fingerprint.b64UrlTo64(samples[0])
      console.log('[FP SDK] PNG generado, size:', imgSrc.length)
      if (modoCaptura === 'asistencia') {
        procesarVerificacionAsistencia(imgSrc)
      } else {
        enviarCapturaAlBackend(imgSrc)
      }
    } catch (e) {
      console.error('[FP SDK] Error procesando muestra:', e.message)
    }
  }

  fpSdk.onQualityReported = function (e) {
    console.log('[FP SDK] Calidad reportada:', e.quality)
  }

  console.log('[FP SDK] Enumerando dispositivos...')
  fpSdk.enumerateDevices().then(function (readers) {
    console.log('[FP SDK] Dispositivos encontrados:', readers)
    sdkCargando.value = false
    if (readers && readers.length > 0) {
      currentReaderUid = readers[0]
      lectorConectado.value = true
      estadoLector.value = 'Lector U.are.U 4500 listo (' + readers.length + ' dispositivo(s))'
    } else {
      estadoLector.value = 'No se detecto lector de huellas. ¿DigitalPersona Agent corriendo?'
      lectorConectado.value = false
    }
  }, function (error) {
    console.error('[FP SDK] Error al enumerar:', error)
    sdkCargando.value = false
    estadoLector.value = 'Error al buscar dispositivos: ' + (error.message || error)
    lectorConectado.value = false
  })
}

function iniciarCapturaSDK() {
  console.log('[FP SDK] iniciarCapturaSDK - capturing:', capturing, 'readerUid:', currentReaderUid)
  if (capturing) {
    console.warn('[FP SDK] Ya esta capturando')
    return
  }
  if (!currentReaderUid) {
    console.log('[FP SDK] No hay readerUid, re-enumerando...')
    fpSdk.enumerateDevices().then(function (readers) {
      if (readers && readers.length > 0) {
        currentReaderUid = readers[0]
        lectorConectado.value = true
        estadoLector.value = 'Lector listo'
        iniciarCapturaSDK()
      } else {
        showToast('Lector no detectado. Verifique la conexion USB y el DigitalPersona Agent.', 'error')
      }
    })
    return
  }

  console.log('[FP SDK] Iniciando adquisicion en', currentReaderUid, 'formato: PngImage')
  currentFormat = Fingerprint.SampleFormat.PngImage
  fpSdk.startAcquisition(currentFormat, currentReaderUid).then(function () {
    console.log('[FP SDK] Adquisicion iniciada OK')
    capturing = true
  }, function (error) {
    console.error('[FP SDK] Error al iniciar adquisicion:', error)
    showToast('Error al iniciar captura: ' + (error.message || error), 'error')
  })
}

function detenerCapturaSDK() {
  if (!capturing || !fpSdk) return
  console.log('[FP SDK] Deteniendo captura...')
  fpSdk.stopAcquisition().then(function () {
    console.log('[FP SDK] Captura detenida')
    capturing = false
  }, function (e) {
    console.warn('[FP SDK] Error al detener:', e)
    capturing = false
  })
}

// =============================================
// VERIFICACIÓN BIOMÉTRICA PARA ASISTENCIA
// =============================================
function iniciarVerificacionHuella() {
  if (!fpSdk || !lectorConectado.value) {
    showToast('El lector de huellas no está conectado.', 'error')
    return
  }
  if (!fichaSeleccionada.value) {
    showToast('Selecciona una ficha primero.', 'error')
    return
  }
  verificandoHuella.value = true
  ultimaVerificacion.value = null
  modoCaptura = 'asistencia'
  showToast('🖐️ Coloque el dedo en el lector para registrar asistencia...', 'info')
  iniciarCapturaSDK()
}

function detenerVerificacionHuella() {
  detenerCapturaSDK()
  verificandoHuella.value = false
  modoCaptura = 'enrolamiento'
}

async function procesarVerificacionAsistencia(imageBase64) {
  try {
    const fichaId = fichaSeleccionada.value._id
    const result = await api.estudiantes.fingerprint.verify(imageBase64, fichaId)

    if (result.match) {
      // Encontró al estudiante: marcarlo como presente
      const estId = result.studentId
      const nombre = `${result.nombres} ${result.apellidos}`
      
      // Verificar que el estudiante pertenece a esta ficha
      const estudianteEnFicha = estudiantesFicha.value.find(e => e._id === estId)
      if (estudianteEnFicha) {
        const reg = asistenciaDia.value[estId]
        if (reg && (reg.estado === 'Presente' || reg.estado === 'Tardanza')) {
          // Ya está marcado, no desmarcar
          ultimaVerificacion.value = {
            exito: true,
            nombre: nombre,
            estado: reg.estado,
            hora: reg.horaMarcacion,
          }
          showToast(`ℹ️ ${nombre} ya estaba marcado como ${reg.estado}.`, 'info')
        } else {
          // Marcar como presente
          marcarPresente(estId)
          ultimaVerificacion.value = {
            exito: true,
            nombre: nombre,
            estado: asistenciaDia.value[estId]?.estado || 'Presente',
            hora: asistenciaDia.value[estId]?.horaMarcacion || '',
          }
          showToast(`✅ ${nombre} - ${asistenciaDia.value[estId]?.estado} (${asistenciaDia.value[estId]?.horaMarcacion})`, 'success')
        }
      } else {
        ultimaVerificacion.value = {
          exito: false,
          nombre: nombre,
          mensaje: 'Estudiante identificado pero no pertenece a esta ficha.',
        }
        showToast(`⚠️ ${nombre} no pertenece a esta ficha.`, 'warning')
      }
    } else {
      ultimaVerificacion.value = {
        exito: false,
        nombre: null,
        mensaje: 'Huella no reconocida. El estudiante puede no estar enrolado.',
      }
      showToast('❌ Huella no reconocida. Intente de nuevo.', 'error')
    }
  } catch (err) {
    console.error('[Verificacion] Error:', err)
    ultimaVerificacion.value = {
      exito: false,
      nombre: null,
      mensaje: 'Error al verificar: ' + err.message,
    }
    showToast('Error al verificar huella: ' + err.message, 'error')
  }

  // Si el modo asistencia sigue activo, reactivar captura para el siguiente estudiante
  if (verificandoHuella.value) {
    setTimeout(() => {
      showToast('🖐️ Lector listo para el siguiente estudiante...', 'info')
      iniciarCapturaSDK()
    }, 1500)
  }
}

// =============================================
// ENROLAMIENTO DE HUELLAS (Solo Líder)
// =============================================
const showEnrolarModal = ref(false)
const estudianteTarget = ref(null)
const pasoEnrolamiento = ref(1)
const capturasCompletadas = ref(0)
const enrolando = ref(false)
const enrollmentSessionId = ref(null)
const dedoSeleccionado = ref('indice_derecho')

const DEDOS = [
  { value: 'pulgar_derecho', label: 'Pulgar Derecho' },
  { value: 'indice_derecho', label: 'Índice Derecho' },
  { value: 'medio_derecho', label: 'Medio Derecho' },
  { value: 'anular_derecho', label: 'Anular Derecho' },
  { value: 'menique_derecho', label: 'Meñique Derecho' },
  { value: 'pulgar_izquierdo', label: 'Pulgar Izquierdo' },
  { value: 'indice_izquierdo', label: 'Índice Izquierdo' },
  { value: 'medio_izquierdo', label: 'Medio Izquierdo' },
  { value: 'anular_izquierdo', label: 'Anular Izquierdo' },
  { value: 'menique_izquierdo', label: 'Meñique Izquierdo' },
]

function abrirModalEnrolamiento(estudiante) {
  estudianteTarget.value = estudiante
  pasoEnrolamiento.value = 1
  capturasCompletadas.value = 0
  enrolando.value = false
  enrollmentSessionId.value = null
  dedoSeleccionado.value = 'indice_derecho'
  showEnrolarModal.value = true
}

async function iniciarEnrolamientoReal() {
  if (typeof Fingerprint === 'undefined' || !fpSdk) {
    showToast('El SDK de DigitalPersona no está disponible en la página.', 'error')
    return
  }

  enrolando.value = true
  pasoEnrolamiento.value = 2
  capturasCompletadas.value = 0

  try {
    const data = await api.estudiantes.fingerprint.enrollStart(
      estudianteTarget.value._id,
      `${estudianteTarget.value.nombres} ${estudianteTarget.value.apellidos}`,
      estudianteTarget.value.numeroDocumento,
      dedoSeleccionado.value
    )
    enrollmentSessionId.value = data.sessionId
    iniciarCapturaSDK()
  } catch (err) {
    showToast('Error al iniciar enrolamiento real: ' + err.message, 'error')
    enrolando.value = false
    pasoEnrolamiento.value = 1
  }
}

async function enviarCapturaAlBackend(imageBase64) {
  if (!enrollmentSessionId.value) return
  try {
    const data = await api.estudiantes.fingerprint.enrollCapture(enrollmentSessionId.value, imageBase64)
    capturasCompletadas.value = data.captures
    showToast(`Muestra ${data.captures} de 4 registrada correctamente.`, 'info')

    if (data.ready) {
      await completarEnrolamiento()
    } else {
      setTimeout(() => iniciarCapturaSDK(), 600)
    }
  } catch (err) {
    showToast('Error en la muestra: ' + err.message, 'error')
    pasoEnrolamiento.value = 1
    enrolando.value = false
  }
}

async function completarEnrolamiento() {
  detenerCapturaSDK()
  pasoEnrolamiento.value = 3
  try {
    await api.estudiantes.fingerprint.enrollComplete(enrollmentSessionId.value)
    await cargarDatosFicha(fichaSeleccionada.value._id)
    showToast('¡Huella enrolada exitosamente en el sensor USB!', 'success')
  } catch (err) {
    showToast('Error al guardar enrolamiento: ' + err.message, 'error')
  } finally {
    enrolando.value = false
    enrollmentSessionId.value = null
  }
}

// =============================================
// GESTIONAR ESTUDIANTES (Solo Líder)
// =============================================
const showEditEstudianteModal = ref(false)
const estudianteEditando = ref(null)
const editForm = reactive({
  nombres: '',
  apellidos: '',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  correo: '',
  telefono: '',
  genero: '',
  estado: 'Activo',
})
const guardandoEstudiante = ref(false)

function abrirEditarEstudiante(est) {
  estudianteEditando.value = est
  editForm.nombres = est.nombres
  editForm.apellidos = est.apellidos
  editForm.tipoDocumento = est.tipoDocumento || 'CC'
  editForm.numeroDocumento = est.numeroDocumento
  editForm.correo = est.correo
  editForm.telefono = est.telefono
  editForm.genero = est.genero || ''
  editForm.estado = est.estado || 'Activo'
  showEditEstudianteModal.value = true
}

async function guardarEstudiante() {
  guardandoEstudiante.value = true
  try {
    await api.estudiantes.update(estudianteEditando.value._id, {
      nombres: editForm.nombres,
      apellidos: editForm.apellidos,
      tipoDocumento: editForm.tipoDocumento,
      numeroDocumento: editForm.numeroDocumento,
      correo: editForm.correo,
      telefono: editForm.telefono,
      genero: editForm.genero,
      estado: editForm.estado,
    })
    await cargarDatosFicha(fichaSeleccionada.value._id)
    showEditEstudianteModal.value = false
    showToast('Datos del aprendiz actualizados correctamente')
  } catch (err) {
    showToast('Error al actualizar: ' + err.message, 'error')
  } finally {
    guardandoEstudiante.value = false
  }
}

// =============================================
// EXPORTAR A EXCEL
// =============================================
function exportarAsistenciaDia() {
  const hoy = fechaAsistencia.value
  const data = estudiantesFicha.value.map(est => {
    const reg = asistenciaDia.value[est._id]
    return {
      'Aprendiz': `${est.nombres} ${est.apellidos}`,
      'Tipo Doc.': est.tipoDocumento,
      'Documento': est.numeroDocumento,
      'Estado': reg ? (reg.excusa ? 'Excusada' : reg.estado) : 'Sin registro',
      'Excusa': reg?.excusa ? 'Sí' : 'No',
      'Fecha': hoy,
    }
  })
  descargarExcel(data, `Asistencia_${fichaSeleccionada.value.codigoFicha}_${hoy}`)
}

function exportarHistorial() {
  const data = asistenciasFicha.value.map(asis => {
    const est = estudiantesFicha.value.find(e => e._id === asis.estudianteId)
    return {
      'Fecha': asis.fecha,
      'Hora': asis.hora || '—',
      'Aprendiz': est ? `${est.nombres} ${est.apellidos}` : asis.estudianteId,
      'Documento': est ? est.numeroDocumento : '',
      'Estado': asis.estado,
    }
  })
  descargarExcel(data, `Historial_${fichaSeleccionada.value.codigoFicha}`)
}

function exportarListaEstudiantes() {
  const data = estudiantesFicha.value.map(est => ({
    'Nombres': est.nombres,
    'Apellidos': est.apellidos,
    'Tipo Doc.': est.tipoDocumento,
    'Documento': est.numeroDocumento,
    'Correo': est.correo,
    'Teléfono': est.telefono,
    'Género': est.genero || '',
    'Estado': est.estado,
    'Huella Enrolada': est.huellaEnrolada ? 'Sí' : 'No',
  }))
  descargarExcel(data, `Estudiantes_${fichaSeleccionada.value.codigoFicha}`)
}

function descargarExcel(data, nombreArchivo) {
  if (data.length === 0) {
    showToast('No hay datos para exportar', 'warning')
    return
  }
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  // Auto-ajustar ancho de columnas
  const maxWidths = {}
  const keys = Object.keys(data[0])
  keys.forEach(key => {
    maxWidths[key] = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    )
  })
  ws['!cols'] = keys.map(key => ({ wch: Math.min(maxWidths[key] + 2, 40) }))

  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
  showToast(`📥 Archivo "${nombreArchivo}.xlsx" descargado`)
}
</script>

<template>
  <div class="panel-instructor">
    <!-- Toast Notification -->
    <Transition name="toast-fade">
      <div v-if="toast.show" class="toast-notification" :class="'toast-' + toast.type">
        {{ toast.message }}
      </div>
    </Transition>

    <!-- Encabezado del Instructor -->
    <div class="instructor-header">
      <div>
        <h2>Bienvenido, {{ usuario.nombre }}</h2>
        <p class="subtitle">Panel de Control de Instructor SENA</p>
      </div>

      <div class="user-badge" style="display: flex; gap: 12px; align-items: center;">
        <span class="role-pill">Docente</span>
        <button class="btn-logout-panel" @click="cerrarSesion">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar Sesión
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-box">
      Cargando tus fichas y grupos asignados...
    </div>

    <div v-else-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-else class="content-layout">
      <!-- Selector de Fichas -->
      <div class="fichas-sidebar">
        <h3>Mis Fichas Asignadas</h3>
        <div v-if="misFichas.length === 0" class="no-fichas">
          No tienes fichas asignadas actualmente. Contacta al Administrador.
        </div>
        <div
          v-for="ficha in misFichas"
          :key="ficha._id"
          class="ficha-card"
          :class="{ active: fichaSeleccionada && fichaSeleccionada._id === ficha._id }"
          @click="seleccionarFicha(ficha)"
        >
          <div class="ficha-card-header">
            <span class="ficha-code">Ficha {{ ficha.codigoFicha }}</span>
            <!-- Badge de Liderazgo -->
            <span v-if="ficha.esLider" class="badge badge-lider" title="Docente Líder de esta Ficha">
              👑 Líder
            </span>
            <span v-else class="badge badge-comun" title="Docente Común en esta Ficha">
              👤 Común
            </span>
          </div>
          <div class="ficha-title">{{ ficha.nombrePrograma }}</div>
          <div class="ficha-sub">Aula: {{ ficha.aulaAsignada }} | {{ ficha.jornada }}</div>
        </div>
      </div>

      <!-- Detalle y Operaciones de la Ficha Seleccionada -->
      <div v-if="fichaSeleccionada" class="ficha-detail">
        <div class="ficha-banner">
          <div class="banner-title">
            <h3>{{ fichaSeleccionada.nombrePrograma }} ({{ fichaSeleccionada.codigoFicha }})</h3>
            <span v-if="fichaSeleccionada.esLider" class="badge-banner badge-lider">
              👑 Docente Líder de la Ficha
            </span>
            <span v-else class="badge-banner badge-comun">
              👤 Docente Común
            </span>
          </div>
          <div class="banner-actions">
            <button
              class="tab-btn"
              :class="{ active: vistaFicha === 'asistencia' }"
              @click="vistaFicha = 'asistencia'"
            >
              📋 Tomar Asistencia
            </button>
            <button
              class="tab-btn"
              :class="{ active: vistaFicha === 'editar_asistencia' }"
              @click="vistaFicha = 'editar_asistencia'"
            >
              ✏️ Historial
            </button>
            <!-- BOTÓN GESTIONAR ESTUDIANTES: Exclusivo para Docente Líder -->
            <button
              class="tab-btn"
              :class="{ active: vistaFicha === 'gestionar_estudiantes', disabled: !fichaSeleccionada.esLider }"
              :disabled="!fichaSeleccionada.esLider"
              @click="fichaSeleccionada.esLider && (vistaFicha = 'gestionar_estudiantes')"
              :title="!fichaSeleccionada.esLider ? 'Gestionar estudiantes requiere ser Docente Líder' : ''"
            >
              📝 Gestionar Estudiantes
              <span v-if="!fichaSeleccionada.esLider" class="lock-icon">🔒</span>
            </button>
            <!-- BOTÓN DE ENROLAMIENTO: Exclusivo para Docente Líder -->
            <button
              class="tab-btn"
              :class="{ active: vistaFicha === 'enrolar_huella', disabled: !fichaSeleccionada.esLider }"
              :disabled="!fichaSeleccionada.esLider"
              @click="fichaSeleccionada.esLider && (vistaFicha = 'enrolar_huella')"
              :title="!fichaSeleccionada.esLider ? 'El enrolamiento de huellas requiere ser Docente Líder de la Ficha' : ''"
            >
              ☝️ Enrolar Huellas
              <span v-if="!fichaSeleccionada.esLider" class="lock-icon">🔒</span>
            </button>
            <button
              class="tab-btn"
              :class="{ active: vistaFicha === 'docentes' }"
              @click="vistaFicha = 'docentes'"
            >
              👥 Equipo Docente
            </button>
          </div>
        </div>

        <!-- ========================================= -->
        <!-- VISTA 1: TOMAR ASISTENCIA (REDISEÑADA)    -->
        <!-- ========================================= -->
        <div v-if="vistaFicha === 'asistencia'" class="section-body">
          <div class="section-header-row">
            <div>
              <h4>Tomar Asistencia</h4>
              <p class="section-desc">Selecciona el estado de cada aprendiz o usa el lector de huellas.</p>
            </div>
            <div class="section-header-actions" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <label class="fecha-label">
                Fecha:
                <input type="date" v-model="fechaAsistencia" @change="inicializarAsistenciaDia" class="input-fecha" />
              </label>
            </div>
          </div>

          <!-- Panel de verificación biométrica activa -->
          <div v-if="verificandoHuella" class="biometric-panel">
            <div class="biometric-pulse-icon">☝️</div>
            <div class="biometric-panel-text">
              <strong>Lector biométrico activo</strong>
              <span>Esperando que los estudiantes coloquen su dedo en el sensor...</span>
            </div>
            <div v-if="ultimaVerificacion" class="biometric-last-result" :class="{ 'result-ok': ultimaVerificacion.exito, 'result-fail': !ultimaVerificacion.exito }">
              <span v-if="ultimaVerificacion.exito">
                ✅ {{ ultimaVerificacion.nombre }} — {{ ultimaVerificacion.estado }} ({{ ultimaVerificacion.hora }})
              </span>
              <span v-else>
                ❌ {{ ultimaVerificacion.mensaje }}
              </span>
            </div>
          </div>

          <!-- Contadores rápidos -->
          <div class="conteo-row">
            <div class="conteo-chip conteo-presente">✅ Presentes: {{ conteoAsistencia.Presente }}</div>
            <div class="conteo-chip conteo-tardanza">⏰ Tardanza: {{ conteoAsistencia.Tardanza }}</div>
            <div class="conteo-chip conteo-falta">❌ Falta: {{ conteoAsistencia.Falta }}</div>
            <div class="conteo-chip conteo-excusada">📋 Excusada: {{ conteoAsistencia.Excusada }}</div>
          </div>

          <div class="info-alert-bar" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;">
            ⏰ <strong>Cálculo Automático de Tardanza:</strong> Al marcar a un aprendiz como <strong>Presente</strong>, se captura la hora exacta. Si supera los 15 minutos de inicio de jornada ({{ fichaSeleccionada.jornada }}), se asignará automáticamente como <strong>Tardanza</strong>. Quienes queden sin marcar se registrarán como <strong>Falta</strong> al finalizar la jornada.
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Aprendiz</th>
                <th>Documento</th>
                <th>Marcar Presente</th>
                <th>Excusa (F2F)</th>
                <th>Hora Marcación</th>
                <th>Estado Asignado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="est in estudiantesFicha" :key="est._id"
                  :class="{ 'row-excusada': asistenciaDia[est._id]?.excusa }">
                <td><strong>{{ est.nombres }} {{ est.apellidos }}</strong></td>
                <td>{{ est.tipoDocumento }} {{ est.numeroDocumento }}</td>
                <td class="td-radio">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      :checked="asistenciaDia[est._id]?.estado === 'Presente' || asistenciaDia[est._id]?.estado === 'Tardanza'"
                      :disabled="asistenciaDia[est._id]?.excusa"
                      @change="marcarPresente(est._id)"
                    />
                    <span class="checkbox-custom radio-presente"></span>
                  </label>
                </td>
                <td class="td-radio">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      :checked="asistenciaDia[est._id]?.excusa"
                      @change="toggleExcusa(est._id)"
                    />
                    <span class="checkbox-custom"></span>
                  </label>
                </td>
                <td style="font-size: 12px; font-weight: 600; color: #475569;">
                  {{ asistenciaDia[est._id]?.horaMarcacion || '—' }}
                </td>
                <td>
                  <span v-if="asistenciaDia[est._id]?.excusa" class="badge badge-warning">
                    📋 Excusada
                  </span>
                  <span v-else-if="asistenciaDia[est._id]?.estado === 'Presente'" class="badge badge-success">
                    ✅ Presente (A tiempo)
                  </span>
                  <span v-else-if="asistenciaDia[est._id]?.estado === 'Tardanza'" class="badge badge-warning">
                    ⏰ Tardanza (Retardo)
                  </span>
                  <span v-else class="badge badge-danger">
                    ❌ Falta (Automática)
                  </span>
                </td>
              </tr>
              <tr v-if="estudiantesFicha.length === 0">
                <td colspan="6" class="empty-cell">No hay aprendices registrados en esta ficha.</td>
              </tr>
            </tbody>
          </table>

          <div class="action-bar" v-if="estudiantesFicha.length > 0">
            <button class="btn-export" @click="exportarAsistenciaDia" title="Exportar lista del día a Excel">
              📥 Exportar Excel
            </button>
            <button class="btn btn-primary btn-guardar" @click="guardarAsistenciaDia" :disabled="guardandoAsistencia">
              {{ guardandoAsistencia ? '⏳ Finalizando Jornada...' : '🔒 Finalizar Jornada y Guardar' }}
            </button>
          </div>
        </div>

        <!-- ========================================= -->
        <!-- VISTA 2: HISTORIAL DE ASISTENCIAS         -->
        <!-- ========================================= -->
        <div v-if="vistaFicha === 'editar_asistencia'" class="section-body">
          <div class="section-header-row">
            <div>
              <h4>Historial de Asistencias</h4>
              <p class="section-desc">Registros de asistencia de esta ficha:</p>
            </div>
            <button class="btn-export" @click="exportarHistorial" v-if="asistenciasFicha.length > 0">
              📥 Exportar Historial Excel
            </button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Aprendiz</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asis in asistenciasFicha" :key="asis._id">
                <td>{{ asis.fecha }} {{ asis.hora }}</td>
                <td>{{ asis.estudianteId?.nombres || '' }} {{ asis.estudianteId?.apellidos || '' }}</td>
                <td>
                  <span class="status-pill" :class="'status-' + (asis.estado || asis.tipo || '').toLowerCase()">
                    {{ asis.estado || asis.tipo }}
                  </span>
                </td>
              </tr>
              <tr v-if="asistenciasFicha.length === 0">
                <td colspan="3" class="empty-cell">No hay registros de asistencias pasadas.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ========================================= -->
        <!-- VISTA 4: GESTIONAR ESTUDIANTES (LÍDER)    -->
        <!-- ========================================= -->
        <div v-if="vistaFicha === 'gestionar_estudiantes'" class="section-body">
          <div v-if="fichaSeleccionada.esLider">
            <div class="section-header-row">
              <div>
                <h4>👑 Gestionar Datos de Aprendices</h4>
                <p class="section-desc">Edita la información general de los aprendices de la Ficha {{ fichaSeleccionada.codigoFicha }}:</p>
              </div>
              <button class="btn-export" @click="exportarListaEstudiantes" v-if="estudiantesFicha.length > 0">
                📥 Exportar Lista Excel
              </button>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th>Aprendiz</th>
                  <th>Documento</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="est in estudiantesFicha" :key="est._id">
                  <td><strong>{{ est.nombres }} {{ est.apellidos }}</strong></td>
                  <td>{{ est.tipoDocumento }} {{ est.numeroDocumento }}</td>
                  <td>{{ est.correo }}</td>
                  <td>{{ est.telefono }}</td>
                  <td>
                    <span class="status-pill" :class="'status-' + (est.estado || '').toLowerCase()">
                      {{ est.estado }}
                    </span>
                  </td>
                  <td>
                    <button class="btn-sm btn-edit" @click="abrirEditarEstudiante(est)">
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
                <tr v-if="estudiantesFicha.length === 0">
                  <td colspan="6" class="empty-cell">No hay aprendices registrados en esta ficha.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="restricted-box">
            🔒 <strong>Acceso Restringido:</strong> La gestión de datos de aprendices está reservada para el <strong>Docente Líder</strong> de la Ficha.
          </div>
        </div>

        <!-- ========================================= -->
        <!-- VISTA 5: ENROLAMIENTO DE HUELLAS (LÍDER)  -->
        <!-- ========================================= -->
        <div v-if="vistaFicha === 'enrolar_huella'" class="section-body">
          <div v-if="fichaSeleccionada.esLider">
            <h4>☝️ Panel de Enrolamiento Biométrico de Huellas</h4>
            <p class="section-desc">Gestiona el registro de plantillas de huellas dactilares para los aprendices de la Ficha {{ fichaSeleccionada.codigoFicha }}:</p>

            <div class="stats-mini-row">
              <div class="stat-box stat-total">
                <span class="stat-label">Total Aprendices</span>
                <div class="stat-value">{{ estudiantesFicha.length }}</div>
              </div>
              <div class="stat-box stat-enrolada">
                <span class="stat-label">Huellas Enroladas</span>
                <div class="stat-value">
                  {{ estudiantesFicha.filter(e => e.huellaEnrolada).length }}
                </div>
              </div>
              <div class="stat-box stat-pendiente">
                <span class="stat-label">Pendientes</span>
                <div class="stat-value">
                  {{ estudiantesFicha.filter(e => !e.huellaEnrolada).length }}
                </div>
              </div>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th>Aprendiz</th>
                  <th>Documento</th>
                  <th>Estado Huella</th>
                  <th>Fecha Enrolamiento</th>
                  <th>Acción Biométrica</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="est in estudiantesFicha" :key="est._id">
                  <td><strong>{{ est.nombres }} {{ est.apellidos }}</strong></td>
                  <td>{{ est.tipoDocumento }} {{ est.numeroDocumento }}</td>
                  <td>
                    <span v-if="est.huellaEnrolada" class="badge badge-lider">
                      🟢 Enrolada
                    </span>
                    <span v-else class="badge badge-pendiente">
                      🟡 Pendiente
                    </span>
                  </td>
                  <td>{{ est.fechaEnrolamiento || 'Sin registro' }}</td>
                  <td>
                    <button class="btn-sm btn-success" @click="abrirModalEnrolamiento(est)">
                      ☝️ {{ est.huellaEnrolada ? 'Re-enrolar' : 'Enrolar' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="estudiantesFicha.length === 0">
                  <td colspan="5" class="empty-cell">No hay aprendices registrados en esta ficha.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="restricted-box">
            🔒 <strong>Acceso Restringido:</strong> El enrolamiento biométrico de huellas está reservado exclusivamente para el <strong>Docente Líder</strong> de la Ficha.
          </div>
        </div>

        <!-- ========================================= -->
        <!-- VISTA 5: EQUIPO DOCENTE DE LA FICHA       -->
        <!-- ========================================= -->
        <div v-if="vistaFicha === 'docentes'" class="section-body">
          <div class="section-header-row">
            <div>
              <h4>Equipo Docente - Ficha {{ fichaSeleccionada.codigoFicha }}</h4>
              <p class="section-desc">{{ fichaSeleccionada.nombrePrograma }} | Jornada: {{ fichaSeleccionada.jornada }}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;">
            <!-- DOCENTE LÍDER -->
            <div class="docente-card" style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="badge badge-success" style="font-weight: 700;">👑 Docente Líder</span>
                <span v-if="String(fichaSeleccionada.instructorLiderId?._id || fichaSeleccionada.instructorLiderId) === String(usuario.id)" class="badge badge-lider" style="font-size: 11px;">(Tú)</span>
              </div>
              <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #166534;">
                {{ fichaSeleccionada.instructorLiderId?.nombres || 'No asignado' }} {{ fichaSeleccionada.instructorLiderId?.apellidos || '' }}
              </h4>
              <p style="font-size: 13px; color: #374151; margin-bottom: 4px;">
                ✉️ {{ fichaSeleccionada.instructorLiderId?.correo || 'Sin correo' }}
              </p>
              <p style="font-size: 13px; color: #374151; margin-bottom: 4px;" v-if="fichaSeleccionada.instructorLiderId?.telefono">
                📞 {{ fichaSeleccionada.instructorLiderId?.telefono }}
              </p>
              <p style="font-size: 12px; color: #15803d; font-weight: 600; margin-top: 8px;" v-if="fichaSeleccionada.instructorLiderId?.especialidad">
                💼 {{ fichaSeleccionada.instructorLiderId?.especialidad }}
              </p>
            </div>

            <!-- DOCENTES COMUNES -->
            <div
              v-for="doc in (fichaSeleccionada.instructores || [])"
              :key="doc._id || doc"
              class="docente-card"
              style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px;"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="badge badge-neutral" style="font-weight: 600;">👤 Docente Común</span>
                <span v-if="String(doc._id || doc) === String(usuario.id)" class="badge badge-comun" style="font-size: 11px;">(Tú)</span>
              </div>
              <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: #1e293b;">
                {{ doc.nombres || 'Docente' }} {{ doc.apellidos || '' }}
              </h4>
              <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">
                ✉️ {{ doc.correo || 'Sin correo' }}
              </p>
              <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;" v-if="doc.telefono">
                📞 {{ doc.telefono }}
              </p>
              <p style="font-size: 12px; color: #2563eb; font-weight: 600; margin-top: 8px;" v-if="doc.especialidad">
                💼 {{ doc.especialidad }}
              </p>
            </div>
          </div>
          <div v-if="(!fichaSeleccionada.instructores || fichaSeleccionada.instructores.length === 0)" style="padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #64748b; margin-top: 12px;">
            ℹ️ Esta ficha actualmente no tiene otros docentes comunes asignados.
          </div>
        </div>

      </div>
    </div>

    <!-- ========================================= -->
    <!-- MODAL DE ENROLAMIENTO BIOMÉTRICO          -->
    <!-- ========================================= -->
    <div v-if="showEnrolarModal" class="modal-overlay" @click.self="showEnrolarModal = false">
      <div class="modal" style="max-width: 480px; text-align: center; padding: 28px;">
        <h3>☝️ Enrolamiento Biométrico de Huella</h3>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
          Aprendiz: <strong>{{ estudianteTarget?.nombres }} {{ estudianteTarget?.apellidos }}</strong><br>
          <small>Documento: {{ estudianteTarget?.tipoDocumento }} {{ estudianteTarget?.numeroDocumento }}</small>
        </p>

        <div class="sensor-box">
          <div class="fingerprint-icon">
            <span v-if="pasoEnrolamiento === 1">🖐️</span>
            <span v-else-if="pasoEnrolamiento === 2" style="animation: pulse 1s infinite;">☝️</span>
            <span v-else>✅</span>
          </div>

          <div v-if="pasoEnrolamiento === 1">
            <h4 style="color: #1e293b; margin-bottom: 6px;">Lector USB U.are.U 4500 Listo</h4>
            <p style="color: #64748b; font-size: 13px;">Haz clic en "Capturar Muestra" para solicitar la huella al aprendiz.</p>
          </div>

          <div v-if="pasoEnrolamiento === 2">
            <h4 style="color: #2563eb; margin-bottom: 6px;">Capturando Muestras...</h4>
            <p style="color: #64748b; font-size: 13px;">Coloque y levante el dedo del sensor 3 veces</p>
            <div style="font-size: 16px; font-weight: 700; color: #2563eb; margin-top: 10px;">
              Muestra {{ capturasCompletadas }} / 3 completada(s)
            </div>
          </div>

          <div v-if="pasoEnrolamiento === 3">
            <h4 style="color: #16a34a; margin-bottom: 6px;">¡Huella Enrolada Exitosamente!</h4>
            <p style="color: #15803d; font-size: 13px;">La plantilla biométrica se guardó correctamente en la base de datos.</p>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="btn btn-outline" @click="showEnrolarModal = false" :disabled="enrolando">
            {{ pasoEnrolamiento === 3 ? 'Cerrar' : 'Cancelar' }}
          </button>
          <button v-if="pasoEnrolamiento === 1" class="btn btn-primary" @click="iniciarEnrolamientoReal" :disabled="enrolando">
            ☝️ Iniciar Captura
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================= -->
    <!-- MODAL EDITAR ESTUDIANTE (LÍDER)           -->
    <!-- ========================================= -->
    <div v-if="showEditEstudianteModal" class="modal-overlay" @click.self="showEditEstudianteModal = false">
      <div class="modal modal-edit">
        <h3>✏️ Editar Datos del Aprendiz</h3>
        <div class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Nombres</label>
              <input v-model="editForm.nombres" type="text" class="form-input" />
            </div>
            <div class="form-group">
              <label>Apellidos</label>
              <input v-model="editForm.apellidos" type="text" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 0.4;">
              <label>Tipo Doc.</label>
              <select v-model="editForm.tipoDocumento" class="form-input">
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PEP">PEP</option>
              </select>
            </div>
            <div class="form-group">
              <label>Número de Documento</label>
              <input v-model="editForm.numeroDocumento" type="text" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input v-model="editForm.correo" type="email" class="form-input" />
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input v-model="editForm.telefono" type="text" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Género</label>
              <select v-model="editForm.genero" class="form-input">
                <option value="">Sin especificar</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label>Estado</label>
              <select v-model="editForm.estado" class="form-input">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Retirado">Retirado</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showEditEstudianteModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardarEstudiante" :disabled="guardandoEstudiante">
            {{ guardandoEstudiante ? '⏳ Guardando...' : '💾 Guardar Cambios' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================= -->
    <!-- MODAL RECHAZAR EXCUSA                     -->
    <!-- ========================================= -->
    <div v-if="showRechazoModal" class="modal-overlay" @click.self="showRechazoModal = false">
      <div class="modal" style="max-width: 420px;">
        <h3>Rechazar Excusa</h3>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 16px;">Ingresa el motivo del rechazo:</p>
        <textarea
          v-model="motivoRechazo"
          class="form-input"
          rows="3"
          placeholder="Motivo del rechazo..."
          style="width: 100%; resize: vertical;"
        ></textarea>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showRechazoModal = false">Cancelar</button>
          <button class="btn btn-danger-solid" @click="confirmarRechazo">Rechazar</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.panel-instructor {
  padding: 24px;
  position: relative;
}

/* Toast */
.toast-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  z-index: 99999;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.1);
  max-width: 360px;
  width: auto;
  word-break: break-word;
}
.toast-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.toast-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.toast-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.toast-fade-enter-active, .toast-fade-leave-active { transition: all 0.3s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateY(-12px); }

.instructor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.subtitle {
  color: var(--text-muted, #64748b);
  font-size: 14px;
}

.role-pill {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
}

.content-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
}

@media (max-width: 860px) {
  .content-layout {
    grid-template-columns: 1fr;
  }
}

.fichas-sidebar {
  background: var(--bg-card, #ffffff);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.fichas-sidebar h3 {
  font-size: 15px;
  margin-bottom: 16px;
  color: var(--text, #1e293b);
}

.ficha-card {
  background: var(--bg-muted, #f8fafc);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ficha-card:hover {
  border-color: #3b82f6;
  transform: translateY(-1px);
}

.ficha-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.ficha-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ficha-code {
  font-weight: 700;
  font-size: 14px;
  color: #1e293b;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}

.badge-lider { background: #dcfce7; color: #15803d; }
.badge-comun { background: #e0f2fe; color: #0369a1; }
.badge-pendiente { background: #fef3c7; color: #92400e; }

.ficha-title { font-size: 13px; color: #334155; margin-bottom: 4px; }
.ficha-sub { font-size: 11px; color: #64748b; }

.ficha-detail {
  background: var(--bg-card, #ffffff);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.ficha-banner {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.banner-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover:not(.disabled) {
  border-color: #3b82f6;
  color: #2563eb;
}

.tab-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.tab-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f1f5f9;
}

.lock-icon { margin-left: 4px; font-size: 11px; }

/* Section header */
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.section-desc {
  color: #64748b;
  font-size: 13px;
  margin-top: 4px;
}

.input-fecha {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  margin-left: 8px;
}

.fecha-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

/* Contadores */
.conteo-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.conteo-chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.conteo-presente { background: #dcfce7; color: #15803d; }
.conteo-tardanza { background: #fef3c7; color: #92400e; }
.conteo-falta { background: #fee2e2; color: #991b1b; }
.conteo-excusada { background: #e0f2fe; color: #0369a1; }

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.data-table th, .data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}

.td-radio {
  text-align: center;
  width: 80px;
}

.row-excusada {
  background: #eff6ff;
}

/* Custom Radio */
.radio-label, .checkbox-label {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.radio-label input, .checkbox-label input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.radio-custom {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  transition: all 0.15s ease;
  position: relative;
}

.radio-label input:checked ~ .radio-presente {
  border-color: #22c55e;
  background: #22c55e;
  box-shadow: inset 0 0 0 3px #fff;
}

.radio-label input:checked ~ .radio-tardanza {
  border-color: #f59e0b;
  background: #f59e0b;
  box-shadow: inset 0 0 0 3px #fff;
}

.radio-label input:checked ~ .radio-falta {
  border-color: #ef4444;
  background: #ef4444;
  box-shadow: inset 0 0 0 3px #fff;
}

.radio-label input:disabled ~ .radio-custom {
  opacity: 0.3;
  cursor: not-allowed;
}

.checkbox-custom {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid #cbd5e1;
  transition: all 0.15s ease;
  position: relative;
}

.checkbox-label input:checked ~ .checkbox-custom {
  border-color: #3b82f6;
  background: #3b82f6;
}

.checkbox-label input:checked ~ .checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

/* Buttons */
.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.btn-guardar {
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 700;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-export:hover {
  border-color: #16a34a;
  color: #16a34a;
  background: #f0fdf4;
}

.action-buttons { display: flex; gap: 6px; }

.btn-sm {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.15s;
}
.btn-sm:hover { opacity: 0.85; }

.btn-success { background: #22c55e; color: white; }
.btn-warning { background: #f59e0b; color: white; }
.btn-danger { background: #ef4444; color: white; }
.btn-edit { background: #3b82f6; color: white; }

.btn-danger-solid {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

/* Status pills */
.status-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.status-presente { background: #dcfce7; color: #15803d; }
.status-tardanza { background: #fef3c7; color: #92400e; }
.status-falta { background: #fee2e2; color: #991b1b; }
.status-excusada { background: #e0f2fe; color: #0369a1; }
.status-pendiente { background: #fef3c7; color: #92400e; }
.status-aprobada { background: #dcfce7; color: #15803d; }
.status-rechazada { background: #fee2e2; color: #991b1b; }
.status-activo { background: #dcfce7; color: #15803d; }
.status-inactivo { background: #fee2e2; color: #991b1b; }
.status-retirado { background: #f1f5f9; color: #64748b; }

.restricted-box {
  padding: 24px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  color: #9f1239;
  font-size: 14px;
}

.empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 24px !important;
}

/* Stats boxes */
.stats-mini-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-box {
  padding: 12px 18px;
  border-radius: 8px;
}

.stat-total { background: #f8fafc; border: 1px solid #e2e8f0; }
.stat-enrolada { background: #f0fdf4; border: 1px solid #bbf7d0; }
.stat-pendiente { background: #fefce8; border: 1px solid #fef08a; }

.stat-label { font-size: 12px; color: #64748b; }
.stat-value { font-size: 20px; font-weight: 700; color: #1e293b; }
.stat-enrolada .stat-label { color: #166534; }
.stat-enrolada .stat-value { color: #15803d; }
.stat-pendiente .stat-label { color: #854d0e; }
.stat-pendiente .stat-value { color: #a16207; }

/* Sensor box */
.sensor-box {
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.fingerprint-icon { font-size: 48px; margin-bottom: 12px; }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-edit {
  width: 560px;
  max-width: 95vw;
}

.modal h3 {
  margin-bottom: 16px;
  color: #1e293b;
}

.modal-form {
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

@media (max-width: 560px) {
  .form-row {
    flex-direction: column;
  }
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.15s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

/* Logout */
.btn-logout-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ef4444;
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-logout-panel:hover {
  background: #dc2626;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* ===== Biometric Attendance Panel ===== */
.btn-biometric {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-biometric:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-biometric:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-biometric-stop {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  animation: pulse 2s infinite;
}

.btn-biometric-stop:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
}

.biometric-panel {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border: 2px solid #6ee7b7;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.biometric-pulse-icon {
  font-size: 32px;
  animation: pulse 1.5s infinite;
}

.biometric-panel-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.biometric-panel-text strong {
  color: #065f46;
  font-size: 14px;
}

.biometric-panel-text span {
  color: #047857;
  font-size: 12px;
}

.biometric-last-result {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  width: 100%;
  text-align: center;
  margin-top: 4px;
}

.biometric-last-result.result-ok {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.biometric-last-result.result-fail {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
</style>
