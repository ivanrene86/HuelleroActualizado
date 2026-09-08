import Clase from '../models/Clase.js'
import { emitirActivacion, emitirDesactivacion } from '../services/socketService.js'

export async function activar(req, res) {
  const { deviceId, fichaId, instructorId } = req.body
  if (!deviceId || !fichaId || !instructorId) {
    return res.status(400).json({ success: false, error: 'deviceId, fichaId e instructorId son requeridos' })
  }

  try {
    let clase = await Clase.findOne({ deviceId, estado: 'Activa' })
    if (clase) {
      clase.fichaId = fichaId
      clase.instructorId = instructorId
      clase.iniciadaAt = new Date()
      await clase.save()
    } else {
      clase = await Clase.create({ deviceId, fichaId, instructorId, estado: 'Activa', iniciadaAt: new Date() })
    }

    const enviado = emitirActivacion(deviceId, { type: 'ACTIVATE', fichaId, instructorId })

    res.json({ success: true, clase, enviadoPorWebSocket: enviado })
  } catch (err) {
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
