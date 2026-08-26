import { getConfig, iniciarRegistroDispositivo, tieneIdentidad } from './config.js'
import * as store from './store.js'
import * as ws from './ws-client.js'
import { capturarHuella } from './capture.js'
import { syncPendientes } from './sync.js'
import { identificarEstudiante } from '../verify.js'

let docente = null
let onEstadoChange = null

export function setOnEstadoChange(cb) {
  onEstadoChange = cb
}

function notificarEstado() {
  if (onEstadoChange) onEstadoChange()
}

export async function init() {
  await store.init()
  ws.setOnStatusChange(notificarEstado)
  ws.connect(getConfig())
  syncPendientes()
  iniciarRegistroDispositivo(() => {
    ws.connect(getConfig())
    notificarEstado()
  })
}

export function getStatus() {
  return {
    online: ws.getConnectionStatus(),
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
  }
}

export async function capturarYVerificar() {
  const clase = store.getClaseActiva()
  if (!clase) {
    return { ok: false, error: 'No hay clase activa en este dispositivo' }
  }

  const imagen = await capturarHuella()
  if (!imagen) {
    return { ok: false, error: 'Captura de huella no disponible aún' }
  }

  const plantillas = await store.getPlantillasFicha(clase.fichaId)
  return identificarEstudiante(imagen, plantillas)
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
    res = await fetch(`${backendUrl}/api/fichas/mis-fichas/${docente.id}`, { signal: AbortSignal.timeout(10000) })
  } catch {
    return { ok: false, error: 'Sin conexión: no se puede obtener la ficha' }
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

export async function enrolarEstudiante({ estudianteId, fichaId, dedo }) {
  if (!estudianteId || !fichaId) {
    return { ok: false, error: 'Selecciona un estudiante' }
  }

  const clase = store.getClaseActiva()
  if (clase) {
    return { ok: false, error: 'Finaliza la clase activa en este dispositivo antes de enrolar' }
  }

  const imagen = await capturarHuella()
  if (!imagen) {
    return { ok: false, error: 'Captura de huella no disponible aún' }
  }

  // TODO Fase 5: transformar la imagen en template con el motor local y llamar guardarTemplate.
  return { ok: false, error: 'Captura de huella no disponible aún' }
}

export function logoutDocente() {
  docente = null
  return { ok: true }
}
