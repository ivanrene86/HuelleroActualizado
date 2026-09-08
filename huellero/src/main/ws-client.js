// huellero/src/main/ws-client.js
//
// Cliente WebSocket del huellero hacia el backend central (socket.io).
//
// Responsabilidades:
//   1. Conectar/reconectar con el backend usando config ({ wsUrl/backendUrl, deviceId, token }).
//   2. Autenticarse enviando HELLO { deviceId, token } como primer mensaje tras cada conexión.
//   3. Despachar mensajes entrantes del backend (ACTIVATE / DEACTIVATE) a callbacks registrables.
//   4. Reconexión automática con backoff exponencial (2s inicial → tope 60s), sin tumbar el proceso.
//   5. Exponer un singleton (default export) con: connect, isConnected, onActivate,
//      onDeactivate, onConnectionChange, send.
//
// NOTA: usa socket.io-client (ya es dependencia del huellero); el backend es un servidor
// socket.io (backend/services/socketService.js), no WebSocket crudo.
//
// NO gestiona sincronización de asistencias pendientes: eso es sync.js.

import { io } from 'socket.io-client'

// ---------------------------------------------------------------------------
// Estado del singleton
// ---------------------------------------------------------------------------
let socket = null
let connected = false
let currentConfig = null

const activateHandlers = []
const deactivateHandlers = []
const connectionChangeHandlers = []

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------
function log(...args) {
  console.log('[ws-client]', ...args)
}

function logError(...args) {
  console.error('[ws-client]', ...args)
}

// Actualiza el estado de conexión y notifica a los suscriptores (solo si cambió).
function setConnected(value) {
  if (connected === value) return
  connected = value
  connectionChangeHandlers.forEach((fn) => {
    try {
      fn(value)
    } catch (err) {
      logError('Error en onConnectionChange:', err.message)
    }
  })
}

// Normaliza un payload entrante. Por robustez acepta objetos o strings JSON;
// un JSON malformado jamás tumba el proceso (se devuelve {}).
function normalizarPayload(payload) {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (err) {
      logError('Payload JSON malformado ignorado:', err.message)
      return {}
    }
  }
  return payload && typeof payload === 'object' ? payload : {}
}

function despachar(handlers, payload, evento) {
  const data = normalizarPayload(payload)
  handlers.forEach((fn) => {
    try {
      fn(data)
    } catch (err) {
      logError(`Error en handler de ${evento}:`, err.message)
    }
  })
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Conecta (o reconecta) al backend.
 * @param {Object} config { deviceId, token, wsUrl, backendUrl }
 */
export function connect(config) {
  currentConfig = config || {}

  const { deviceId, token, wsUrl, backendUrl } = currentConfig

  if (!deviceId || !token) {
    logError('connect() ignorado: faltan deviceId/token.')
    setConnected(false)
    return
  }

  const url = wsUrl || (backendUrl ? backendUrl.replace(/\/+$/, '') : undefined)
  if (!url) {
    logError('connect() ignorado: falta wsUrl/backendUrl.')
    setConnected(false)
    return
  }

  // Evita sockets duplicados: desconecta el anterior antes de crear uno nuevo.
  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    // Backoff exponencial: 2s inicial, duplicando hasta un tope de 60s.
    reconnectionDelay: 2000,
    reconnectionDelayMax: 60000,
    randomizationFactor: 0.5,
  })

  socket.on('connect', () => {
    log(`Conectado a ${url}`)
    // Autenticación: primer mensaje tras (re)conectar.
    socket.emit('HELLO', { deviceId: String(deviceId), token: String(token) })
    setConnected(true)
  })

  socket.on('disconnect', (reason) => {
    log(`Desconectado (${reason})`)
    setConnected(false)
  })

  socket.on('connect_error', (err) => {
    logError('Error de conexión:', err.message)
  })

  socket.on('ACTIVATE', (payload) => {
    log('ACTIVATE recibido:', payload)
    despachar(activateHandlers, payload, 'onActivate')
  })

  socket.on('DEACTIVATE', (payload) => {
    log('DEACTIVATE recibido:', payload)
    despachar(deactivateHandlers, payload, 'onDeactivate')
  })
}

/**
 * ¿Hay una conexión activa en este momento?
 * @returns {boolean}
 */
export function isConnected() {
  return connected
}

/**
 * Registra un callback para el mensaje ACTIVATE.
 * @param {(payload: { fichaId, instructorId, claseId? }) => void} fn
 * @returns {() => void} función para desuscribir
 */
export function onActivate(fn) {
  if (typeof fn === 'function') activateHandlers.push(fn)
  return () => {
    const i = activateHandlers.indexOf(fn)
    if (i >= 0) activateHandlers.splice(i, 1)
  }
}

/**
 * Registra un callback para el mensaje DEACTIVATE.
 * @param {(payload: { fichaId, claseId? }) => void} fn
 * @returns {() => void} función para desuscribir
 */
export function onDeactivate(fn) {
  if (typeof fn === 'function') deactivateHandlers.push(fn)
  return () => {
    const i = deactivateHandlers.indexOf(fn)
    if (i >= 0) deactivateHandlers.splice(i, 1)
  }
}

/**
 * Registra un callback que se invoca en cada cambio de estado de conexión.
 * @param {(conectado: boolean) => void} fn
 * @returns {() => void} función para desuscribir
 */
export function onConnectionChange(fn) {
  if (typeof fn === 'function') connectionChangeHandlers.push(fn)
  return () => {
    const i = connectionChangeHandlers.indexOf(fn)
    if (i >= 0) connectionChangeHandlers.splice(i, 1)
  }
}

/**
 * Envía un mensaje saliente al backend (para mensajes futuros: acks, etc.).
 * @param {string} type nombre del evento
 * @param {any} payload cuerpo del mensaje
 * @returns {boolean} true si se encoló, false si no hay conexión
 */
export function send(type, payload) {
  if (!socket || !connected) {
    logError(`send('${type}') ignorado: socket no conectado`)
    return false
  }
  socket.emit(type, payload)
  return true
}

// ---------------------------------------------------------------------------
// Singleton exportado por defecto
// ---------------------------------------------------------------------------
const wsClient = {
  connect,
  isConnected,
  onActivate,
  onDeactivate,
  onConnectionChange,
  send,
}

export default wsClient

/*
// ─── Ejemplo de uso ────────────────────────────────────────────────────────
import wsClient from './ws-client.js'

wsClient.onConnectionChange((conectado) => {
  console.log('Estado de conexión:', conectado ? 'online' : 'offline')
})

wsClient.onActivate(({ fichaId, instructorId, claseId }) => {
  console.log('Clase activada:', { fichaId, instructorId, claseId })
})

wsClient.onDeactivate(({ fichaId, claseId }) => {
  console.log('Clase desactivada:', { fichaId, claseId })
})

wsClient.connect({ deviceId: '...', token: '...', wsUrl: 'ws://localhost:3000' })

// mensaje saliente futuro:
wsClient.send('ACTIVATED', { fichaId: '...', claseId: '...' })

console.log('¿Conectado?', wsClient.isConnected())
// ───────────────────────────────────────────────────────────────────────────
*/
