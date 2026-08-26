import { io } from 'socket.io-client'
import * as store from './store.js'

let socket = null
let online = false
let onStatusChange = null

export function connect(config) {
  if (!config.deviceId || !config.token || !config.wsUrl) {
    online = false
    return
  }

  if (socket) {
    socket.disconnect()
  }

  socket = io(config.wsUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    // Backoff de reconexión: empieza en 2s y duplica hasta un máximo de 30s entre intentos.
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  })

  socket.on('connect', () => {
    online = true
    // En cada conexión (incluidas las reconexiones) se re-autentica con HELLO.
    socket.emit('HELLO', { deviceId: config.deviceId, token: config.token })
    notifyStatus()
  })

  socket.on('disconnect', () => {
    online = false
    notifyStatus()
  })

  socket.on('ACTIVATE', (payload) => {
    store.setClaseActiva({
      fichaId: payload?.fichaId ?? null,
      instructorId: payload?.instructorId ?? null,
      estado: 'Activa',
    })
  })
}

export function getConnectionStatus() {
  return online
}

export function setOnStatusChange(cb) {
  onStatusChange = cb
}

function notifyStatus() {
  if (onStatusChange) onStatusChange()
}

export function onMessage(handler) {
  // TODO Fase 6: registrar manejador de mensajes adicionales del backend.
}

export function send(message) {
  // TODO Fase 6: enviar mensaje al backend.
}

export function setOnline(value) {
  online = Boolean(value)
}
