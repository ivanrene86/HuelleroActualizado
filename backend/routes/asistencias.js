import { Router } from 'express'
import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { fichaId, fechaDesde, fechaHasta } = req.query
    const filter = {}
    if (fichaId) filter.fichaId = fichaId
    if (fechaDesde || fechaHasta) {
      filter.fecha = {}
      if (fechaDesde) filter.fecha.$gte = fechaDesde
      if (fechaHasta) filter.fecha.$lte = fechaHasta
    }
    const asistencias = await Asistencia.find(filter).sort({ fecha: 1 })
    res.json(asistencias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { estudianteId, fichaId, fecha, estado, hora, horasTardanza, tiempoTardanza } = req.body
    const asistencia = new Asistencia({
      estudianteId,
      fichaId,
      fecha,
      estado,
      hora,
      horasTardanza: horasTardanza || 0,
      tiempoTardanza: tiempoTardanza || (horasTardanza ? `${horasTardanza} ${horasTardanza === 1 ? 'hora' : 'horas'}` : '0 horas')
    })
    await asistencia.save()

    await Estudiante.findByIdAndUpdate(estudianteId, { estadoAsistencia: estado })

    res.status(201).json(asistencia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
