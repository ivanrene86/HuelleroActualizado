import { Server } from 'socket.io'
import bcryptjs from 'bcryptjs'
import Dispositivo from '../models/Dispositivo.js'
import Clase from '../models/Clase.js'
import Ficha from '../models/Ficha.js'

let io = null
const sesionesActivas = new Map() // fichaId -> { activa: true, iniciadoPor, fecha, jornada, fichaCodigo, nombrePrograma }
const dispositivosConectados = new Map() // deviceId -> socket.id

export function initSocket(httpServer) {
  // Heartbeat: se depende del heartbeat nativo de socket.io (pingInterval 25s / pingTimeout 20s por defecto),
  // que detecta desconexiones y reconexiones automáticamente. No se implementa un PING/PONG manual encima.
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Cliente conectado: ${socket.id}`)

    // 1. Unirse a la sala de una ficha
    socket.on('unirse_sala', ({ fichaId, rol }) => {
      if (!fichaId) return
      const room = `ficha_${fichaId}`
      socket.join(room)
      console.log(`[Socket.IO] Socket ${socket.id} (${rol || 'cliente'}) se unió a sala ${room}`)

      // Informar si ya hay una sesión activa para esta ficha
      const sesion = sesionesActivas.get(String(fichaId))
      socket.emit('estado_sesion', {
        activa: !!sesion?.activa,
        sesion: sesion || null,
      })
    })

    // 2. Salir de la sala
    socket.on('salir_sala', ({ fichaId }) => {
      if (!fichaId) return
      const room = `ficha_${fichaId}`
      socket.leave(room)
    })

    // 3. El docente inicia la sesión de toma de asistencia de forma remota
    socket.on('docente:iniciar_asistencia', (data) => {
      const { fichaId, fichaCodigo, nombrePrograma, jornada, fecha, instructorNombre } = data
      if (!fichaId) return

      const sesion = {
        activa: true,
        fichaId: String(fichaId),
        fichaCodigo: fichaCodigo || '',
        nombrePrograma: nombrePrograma || '',
        jornada: jornada || '',
        fecha: fecha || new Date().toISOString().slice(0, 10),
        instructorNombre: instructorNombre || 'Instructor',
        horaInicio: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }

      sesionesActivas.set(String(fichaId), sesion)
      const room = `ficha_${fichaId}`

      console.log(`[Socket.IO] ▶ Docente activó asistencia remota para ficha ${fichaCodigo} (${room})`)

      // Notificar a la sala de la ficha y a todos los Kioscos en modo Standby global
      io.to(room).emit('kiosco:activar_lectura', sesion)
      io.to('global_kioscos').emit('kiosco:activar_lectura', sesion)
      io.emit('kiosco:activar_lectura_global', sesion)
      io.to(room).emit('estado_sesion', { activa: true, sesion })
    })

    // 4. El docente finaliza/pausa la toma de asistencia
    socket.on('docente:cerrar_asistencia', ({ fichaId }) => {
      if (!fichaId) return
      const room = `ficha_${fichaId}`
      sesionesActivas.delete(String(fichaId))

      console.log(`[Socket.IO] ⏹ Docente detuvo la asistencia para ficha ${fichaId}`)

      io.to(room).emit('kiosco:desactivar_lectura', { fichaId })
      io.to('global_kioscos').emit('kiosco:desactivar_lectura', { fichaId })
      io.emit('kiosco:desactivar_lectura_global', { fichaId })
      io.to(room).emit('estado_sesion', { activa: false, sesion: null })
    })

    // 5. Registro de identidad del huellero local (deviceId + token) al conectar
    socket.on('HELLO', async (data) => {
      const deviceId = data?.deviceId
      const token = data?.token
      if (!deviceId || !token) {
        console.log(`[Socket.IO] HELLO rechazado: faltan deviceId o token (socket ${socket.id})`)
        socket.disconnect(true)
        return
      }

      try {
        const dispositivo = await Dispositivo.findOne({ deviceId: String(deviceId) })

        if (!dispositivo || dispositivo.activo !== true) {
          console.log(`[Socket.IO] HELLO rechazado: dispositivo no encontrado o inactivo (${deviceId}, socket ${socket.id})`)
          socket.disconnect(true)
          return
        }

        const tokenValido = await bcryptjs.compare(token, dispositivo.tokenHash)
        if (!tokenValido) {
          console.log(`[Socket.IO] HELLO rechazado: token inválido para ${deviceId} (socket ${socket.id})`)
          socket.disconnect(true)
          return
        }

        socket.data.deviceId = String(deviceId)
        dispositivosConectados.set(String(deviceId), socket.id)
        console.log(`[Socket.IO] Huellero registrado: ${deviceId} (socket ${socket.id})`)

        // Reenvío del ACTIVATE pendiente tras reconexión (Fase 6):
        // si quedó una clase activa en BD para este deviceId, se la reenvía al recién conectado.
        try {
          const claseActiva = await Clase.findOne({ deviceId: String(deviceId), estado: 'Activa' })
          if (claseActiva) {
            let codigoFicha = ''
            try {
              const ficha = await Ficha.findById(claseActiva.fichaId).select('codigoFicha')
              codigoFicha = ficha?.codigoFicha || ''
            } catch (_) {
              // fichaId inválido o ficha borrada: se omite el código (no es crítico).
            }
            socket.emit('ACTIVATE', {
              type: 'ACTIVATE',
              fichaId: String(claseActiva.fichaId),
              instructorId: String(claseActiva.instructorId),
              codigoFicha,
            })
            console.log(`[Socket.IO] Reenviando ACTIVATE pendiente a ${deviceId} tras reconexión (ficha ${codigoFicha || claseActiva.fichaId})`)
          }
        } catch (err) {
          console.log(`[Socket.IO] Error reenviando ACTIVATE pendiente a ${deviceId}: ${err.message}`)
        }
      } catch (err) {
        console.log(`[Socket.IO] HELLO rechazado por error: ${deviceId} (socket ${socket.id}) - ${err.message}`)
        socket.disconnect(true)
      }
    })

    // 6. El Kiosco registra una huella y notifica en vivo a todos (móvil del docente)
    socket.on('kiosco:asistencia_marcada', (data) => {
      const { fichaId } = data
      if (!fichaId) return
      const room = `ficha_${fichaId}`

      console.log(`[Socket.IO] 🖐 Asistencia marcada en Kiosco: ${data.nombres} ${data.apellidos} (${data.estado})`)

      // Re-transmitir a todos en la sala (especialmente al celular del docente)
      socket.to(room).emit('docente:nueva_marcacion', data)
    })

    socket.on('disconnect', () => {
      if (socket.data.deviceId) {
        dispositivosConectados.delete(String(socket.data.deviceId))
      }
      console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`)
    })
  })

  console.log('[Socket.IO] Servidor de WebSockets en tiempo real inicializado')
  return io
}

export function getIO() {
  return io
}

export function emitirNuevaAsistencia(fichaId, data) {
  if (io && fichaId) {
    io.to(`ficha_${fichaId}`).emit('docente:nueva_marcacion', data)
  }
}

export function emitirAsistenciaRegistrada(fichaId, data) {
  if (io && fichaId) {
    io.to(`ficha_${String(fichaId)}`).emit('ATTENDANCE_REGISTERED', data)
  }
}

export function emitirClaseActivada(fichaId, data) {
  if (io && fichaId) {
    io.to(`ficha_${String(fichaId)}`).emit('CLASS_ACTIVATED', data)
  }
}

export function emitirClaseDesactivada(fichaId, data) {
  if (io && fichaId) {
    io.to(`ficha_${String(fichaId)}`).emit('CLASS_DEACTIVATED', data)
  }
}

export function emitirActivacion(deviceId, payload) {
  if (!io || !deviceId) return false
  const socketId = dispositivosConectados.get(String(deviceId))
  if (!socketId) return false
  io.to(socketId).emit('ACTIVATE', payload)
  return true
}

export function emitirDesactivacion(deviceId, payload) {
  if (!io || !deviceId) return false
  const socketId = dispositivosConectados.get(String(deviceId))
  if (!socketId) return false
  io.to(socketId).emit('DEACTIVATE', payload)
  return true
}
