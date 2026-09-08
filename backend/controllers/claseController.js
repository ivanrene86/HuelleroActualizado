import Clase from '../models/Clase.js'
import { emitirActivacion, emitirDesactivacion } from '../services/socketService.js'

export async function activar(req, res) {
  const { deviceId, fichaId, instructorId } = req.body
  if (!deviceId || !fichaId || !instructorId) {
    return res.status(400).json({ success: false, error: 'deviceId, fichaId e instructorId son requeridos' })
  }

  try {
    // Operación atómica: upsert sobre la clase Activa de ese deviceId.
    // Evita la ventana de carrera de findOne + save/create (que podía crear
    // dos documentos Activa para el mismo dispositivo bajo concurrencia).
    const clase = await Clase.findOneAndUpdate(
      { deviceId, estado: 'Activa' },
      {
        $set: { fichaId, instructorId, iniciadaAt: new Date() },
        $setOnInsert: { deviceId, estado: 'Activa' },
      },
      { upsert: true, new: true }
    )

    const enviado = emitirActivacion(deviceId, { type: 'ACTIVATE', fichaId, instructorId })

    res.json({ success: true, clase, enviadoPorWebSocket: enviado })
  } catch (err) {
    // Carrera real (rara): el índice parcial único rechazó un segundo insert casi
    // simultáneo de una clase Activa para el mismo deviceId.
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Ya hay una clase activándose para este dispositivo. Reintenta en un momento.',
      })
    }
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function finalizar(req, res) {
  const { fichaId, instructorId } = req.body
  if (!fichaId || !instructorId) {
    return res.status(400).json({ success: false, error: 'fichaId e instructorId son requeridos' })
  }

  try {
    const clase = await Clase.findOne({ fichaId, instructorId, estado: 'Activa' })
    if (!clase) {
      return res.status(404).json({ success: false, error: 'No hay clase activa que finalizar para esa ficha e instructor' })
    }

    clase.estado = 'Finalizada'
    clase.finalizadaAt = new Date()
    await clase.save()

    const enviado = emitirDesactivacion(clase.deviceId, {
      type: 'DEACTIVATE',
      fichaId: String(clase.fichaId),
      instructorId: String(clase.instructorId),
    })

    res.json({ success: true, clase, enviadoPorWebSocket: enviado })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}
