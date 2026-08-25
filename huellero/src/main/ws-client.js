import { io } from 'socket.io-client'
import * as store from './store.js'

let socket = null
let online = false

export function connect(config) {
  if (!config.deviceId || !config.token || !config.wsUrl) {
    online = false
    return
  }

  socket = io(config.wsUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
  })

  socket.on('connect', () => {
    online = true
    socket.emit('HELLO', { deviceId: config.deviceId, token: config.token })
  })

  socket.on('disconnect', () => {
    online = false
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

export function onMessage(handler) {
  // TODO Fase 6: registrar manejador de mensajes adicionales del backend.
}

export function send(message) {
  // TODO Fase 6: enviar mensaje al backend.
}

export function setOnline(value) {
  online = Boolean(value)
}
