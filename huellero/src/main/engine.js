import { randomUUID } from 'crypto'
import { getConfig, iniciarRegistroDispositivo, tieneIdentidad } from './config.js'
import * as store from './store.js'
import wsClient from './ws-client.js'
import { capturarHuella, inicializarCaptura } from './capture.js'
import { syncPendientes } from './sync.js'
import { notificarPendienteNuevo } from './scheduler.js'
import { identificarEstudiante } from '../verify.js'
import * as fingerprint from '../fingerprint.js'

let docente = null
let avisoSesion = null
let onEstadoChange = null
let onEnrolarProgreso = null
let enrolamientoCancelado = false

export function setOnEstadoChange(cb) {
  onEstadoChange = cb
}

export function setOnEnrolarProgreso(cb) {
  onEnrolarProgreso = cb
}

export function cancelarEnrolamiento() {
  enrolamientoCancelado = true
}

function notificarEstado() {
  if (onEstadoChange) onEstadoChange()
}

function notificarProgresoEnrolamiento(payload) {
  if (onEnrolarProgreso) onEnrolarProgreso(payload)
}

export async function init() {
  await store.init()
  inicializarCaptura()
  wsClient.onConnectionChange(notificarEstado)
  wsClient.onActivate((payload) => {
    store.setClaseActiva({
      fichaId: payload?.fichaId ?? null,
      instructorId: payload?.instructorId ?? null,
      claseId: payload?.claseId ?? null,
      estado: 'Activa',
    })
    notificarEstado()
  })
  wsClient.onDeactivate(() => {
    store.setClaseActiva(null)
    notificarEstado()
  })
  wsClient.connect(getConfig())
  syncPendientes()
  iniciarRegistroDispositivo(() => {
    wsClient.connect(getConfig())
    notificarEstado()
  })
}

export function getStatus() {
  return {
    online: wsClient.isConnected(),
    claseActiva: store.getClaseActiva() || null,
    dispositivoRegistrado: tieneIdentidad(),
    docente: docente
      ? {
          correo: docente.correo,
          nombre: docente.nombre,
          esLider: docente.esLider,
          rolDetallado: docente.rolDetallado,
        }
      : null,
    avisoSesion,
  }
}

export async function capturarYVerificar() {
  const clase = store.getClaseActiva()
  if (!clase) {
    return { ok: false, error: 'No hay clase activa en este dispositivo' }
  }

  let imagen
  let dpi
  let capturaTimestamp
  try {
    const captura = await capturarHuella()
    imagen = captura.imagen
    dpi = captura.dpi
    // Momento real de la captura (no del guardado posterior).
    capturaTimestamp = Date.now()
  } catch (err) {
    return { ok: false, error: err.message }
  }

  const plantillas = await store.getPlantillasFicha(clase.fichaId)
  const resultado = identificarEstudiante(imagen, plantillas, dpi)

  // Si identificó a un estudiante, persistir la asistencia localmente (offline-ready).
  if (resultado.match && resultado.studentId) {
    try {
      registrarAsistenciaLocal(clase, resultado, capturaTimestamp)
    } catch (err) {
      // Un fallo de guardado no debe ocultar el resultado de identificación.
      console.error('[engine] No se pudo guardar la asistencia pendiente:', err.message)
    }
  }

  return resultado
}

// Ventana anti-duplicado: evita registrar dos veces al mismo estudiante en la
// misma clase en un lapso corto (p. ej. el estudiante coloca el dedo dos veces).
const VENTANA_DEDUP_MS = 2 * 60 * 1000

function registrarAsistenciaLocal(clase, resultado, timestamp) {
  const estudianteId = String(resultado.studentId)
  // La clase se identifica por claseId; si aún no llega (backend no lo envía), por fichaId.
  const claveClase = clase.claseId != null ? String(clase.claseId) : String(clase.fichaId)

  const pendientes = store.getPendientes()
  const yaMarcado = pendientes.some((p) => {
    const pClaveClase = p.claseId != null ? String(p.claseId) : String(p.fichaId)
    return (
      String(p.estudianteId) === estudianteId &&
      pClaveClase === claveClase &&
      p.timestamp != null &&
      timestamp - p.timestamp <= VENTANA_DEDUP_MS
    )
  })

  if (yaMarcado) {
    console.log(`[engine] Asistencia ya registrada para ${estudianteId} en esta clase; se omite duplicado.`)
    return
  }

  const asistencia = {
    uuid: randomUUID(),
    estudianteId: resultado.studentId,
    fichaId: clase.fichaId ?? null,
    claseId: clase.claseId ?? null,
    instructorId: clase.instructorId ?? null,
    timestamp,
    metodo: 'HUELLA',
  }

  store.guardarPendiente(asistencia)
  console.log(`[engine] Asistencia guardada localmente: ${asistencia.uuid} (estudiante ${estudianteId})`)

  // Avisa al scheduler para intentar sincronizar pronto (sin esperar al polling).
  notificarPendienteNuevo()
}

export async function loginDocente(correo, password) {
  if (!correo || !password) {
    return { ok: false, error: 'Ingresa correo y contraseña' }
  }

  const { backendUrl } = getConfig()

  let res
  try {
    res = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password }),
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    return { ok: false, error: 'Sin conexión: no se puede validar el acceso docente' }
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (res.status === 401) {
    return { ok: false, error: 'Correo o contraseña incorrectos' }
  }

  if (res.status === 403) {
    return { ok: false, error: data?.error || 'Tu cuenta no puede acceder al modo docente' }
  }

  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || 'No se pudo iniciar sesión' }
  }

  const usuario = data.usuario
  if (!usuario || usuario.rol !== 'Instructor') {
    return { ok: false, error: 'Solo los instructores pueden acceder al modo docente' }
  }

  docente = {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    esLider: !!usuario.esLider,
    rolDetallado: usuario.rolDetallado || 'Instructor',
    token: data.token || null,
  }

  return { ok: true, docente: { correo: docente.correo, nombre: docente.nombre } }
}

export async function getFichaLider() {
  if (!docente) {
    return { ok: false, error: 'No hay sesión docente activa' }
  }

  const { backendUrl } = getConfig()

  let res
  try {
    res = await fetch(`${backendUrl}/api/fichas/mis-fichas/${docente.id}`, {
      headers: docente.token ? { Authorization: `Bearer ${docente.token}` } : {},
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    return { ok: false, error: 'Sin conexión: no se puede obtener la ficha' }
  }

  if (res.status === 401) {
    docente = null
    avisoSesion = 'Tu sesión expiró. Vuelve a iniciar sesión.'
    notificarEstado()
    setTimeout(() => {
      avisoSesion = null
      notificarEstado()
    }, 6000)
    return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }
  }

  if (!res.ok) {
    return { ok: false, error: 'No se pudo obtener la ficha del líder' }
  }

  const fichas = await res.json().catch(() => null)
  const lista = Array.isArray(fichas) ? fichas : []
  const fichaLider = lista.find((f) => f.esLider) || null

  if (!fichaLider) {
    return { ok: false, error: 'No tienes una ficha asignada como líder' }
  }

  return { ok: true, ficha: fichaLider }
}

export async function getEstudiantesFicha(fichaId) {
  if (!fichaId) {
    return { ok: false, error: 'Ficha no especificada' }
  }

  const { backendUrl } = getConfig()

  let res
  try {
    res = await fetch(`${backendUrl}/api/estudiantes?fichaId=${encodeURIComponent(fichaId)}`, { signal: AbortSignal.timeout(10000) })
  } catch {
    return { ok: false, error: 'Sin conexión: no se pueden obtener los estudiantes' }
  }

  if (!res.ok) {
    return { ok: false, error: 'No se pudieron obtener los estudiantes' }
  }

  const estudiantes = await res.json().catch(() => null)
  return { ok: true, estudiantes: Array.isArray(estudiantes) ? estudiantes : [] }
}

export async function guardarTemplate({ estudianteId, fichaId, dedo, template }) {
  if (!estudianteId || !fichaId || !template) {
    return { ok: false, error: 'Faltan datos para guardar la huella' }
  }

  const { backendUrl } = getConfig()

  let res
  try {
    res = await fetch(`${backendUrl}/api/enrolamiento/guardar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudianteId, fichaId, dedo, template }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return { ok: false, error: 'Sin conexión: no se pudo guardar la huella' }
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: data?.error || 'No se pudo guardar la huella' }
  }

  return { ok: true, ...data }
}

export async function enrolarEstudiante({ estudianteId, fichaId, dedo, nombre }) {
  if (!estudianteId || !fichaId) {
    return { ok: false, error: 'Selecciona un estudiante' }
  }

  const clase = store.getClaseActiva()
  if (clase) {
    return { ok: false, error: 'Finaliza la clase activa en este dispositivo antes de enrolar' }
  }

  if (!fingerprint.isAvailable()) {
    return { ok: false, error: 'Motor biométrico no disponible (dpfj.dll)' }
  }

  const session = fingerprint.startSession(estudianteId, nombre || '', '', dedo || '')
  const sessionId = session.sessionId
  const total = session.capturesNeeded || 4
  const MAX_FALLOS_CONSECUTIVOS = 3

  enrolamientoCancelado = false

  try {
    let actual = 0
    let fallosConsecutivos = 0

    while (true) {
      if (enrolamientoCancelado) {
        fingerprint.cancelSession(sessionId)
        notificarProgresoEnrolamiento({ fase: 'cancelado', actual, total, mensaje: 'Enrolamiento cancelado' })
        return { ok: false, error: 'Enrolamiento cancelado' }
      }

      notificarProgresoEnrolamiento({
        fase: 'esperando_captura',
        actual,
        total,
        mensaje: `Coloque el dedo en el lector (${actual + 1}/${total})`,
      })

      let captura
      try {
        captura = await capturarHuella()
      } catch (err) {
        fallosConsecutivos++
        const motivo = err.message || 'No se pudo capturar la huella'
        notificarProgresoEnrolamiento({ fase: 'captura_fallida', actual, total, mensaje: `${motivo} — reintentando` })

        if (fallosConsecutivos >= MAX_FALLOS_CONSECUTIVOS) {
          fingerprint.cancelSession(sessionId)
          notificarProgresoEnrolamiento({ fase: 'cancelado', actual, total, mensaje: 'Enrolamiento cancelado por fallos consecutivos' })
          return { ok: false, error: `No se pudo capturar una huella válida: ${motivo}` }
        }
        continue // reintenta la MISMA captura (no avanza el contador)
      }

      const res = fingerprint.addCapture(sessionId, captura.imagen, captura.dpi)
      if (res.error) {
        fingerprint.cancelSession(sessionId)
        notificarProgresoEnrolamiento({ fase: 'cancelado', actual, total, mensaje: res.error })
        return { ok: false, error: res.error }
      }

      fallosConsecutivos = 0
      actual = res.captures

      if (res.ready) {
        notificarProgresoEnrolamiento({ fase: 'captura_aceptada', actual, total, mensaje: 'Generando template…' })
        break
      }

      notificarProgresoEnrolamiento({
        fase: 'captura_aceptada',
        actual,
        total,
        mensaje: `Captura ${actual} aceptada. Retire el dedo y vuelva a colocarlo.`,
      })
    }

    const completo = fingerprint.completeEnrollment(sessionId)
    if (completo.error) {
      notificarProgresoEnrolamiento({ fase: 'cancelado', actual, total, mensaje: completo.error })
      return { ok: false, error: completo.error }
    }

    notificarProgresoEnrolamiento({ fase: 'guardando', actual, total, mensaje: 'Guardando huella…' })
    const guardado = await guardarTemplate({ estudianteId, fichaId, dedo, template: completo.template })

    if (guardado.ok) {
      notificarProgresoEnrolamiento({ fase: 'completado', actual, total, mensaje: 'Huella registrada correctamente' })
    }
    return guardado
  } catch (err) {
    fingerprint.cancelSession(sessionId)
    return { ok: false, error: err.message }
  }
}

export function logoutDocente() {
  docente = null
  return { ok: true }
}
