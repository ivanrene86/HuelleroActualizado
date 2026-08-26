import { Server } from 'socket.io'

let io = null
const sesionesActivas = new Map() // fichaId -> { activa: true, iniciadoPor, fecha, jornada, fichaCodigo, nombrePrograma }

export function initSocket(httpServer) {
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

    // 5. El Kiosco registra una huella y notifica en vivo a todos (móvil del docente)
    socket.on('kiosco:asistencia_marcada', (data) => {
      const { fichaId } = data
      if (!fichaId) return
      const room = `ficha_${fichaId}`

      console.log(`[Socket.IO] 🖐 Asistencia marcada en Kiosco: ${data.nombres} ${data.apellidos} (${data.estado})`)

      // Re-transmitir a todos en la sala (especialmente al celular del docente)
      socket.to(room).emit('docente:nueva_marcacion', data)
    })

    socket.on('disconnect', () => {
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
