import Clase from '../models/Clase.js'
import { emitirActivacion } from '../services/socketService.js'

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
