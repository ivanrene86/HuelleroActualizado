import { Router } from 'express'
import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { fichaId, fecha, fechaDesde, fechaHasta } = req.query
    const filter = {}
    if (fichaId) filter.fichaId = fichaId
    if (fecha) filter.fecha = fecha
    if (fechaDesde || fechaHasta) {
      filter.fecha = {}
      if (fechaDesde) filter.fecha.$gte = fechaDesde
      if (fechaHasta) filter.fecha.$lte = fechaHasta
    }
    const asistencias = await Asistencia.find(filter).populate('estudianteId').populate('instructorId').sort({ fecha: 1, createdAt: 1 })
    res.json(asistencias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { estudianteId, fichaId, fecha, estado, hora, horasTardanza, tiempoTardanza, motivoInhabilitacion, instructorId } = req.body
    
    // Upsert para evitar registros duplicados del mismo estudiante en la misma fecha y ficha
    const asistencia = await Asistencia.findOneAndUpdate(
      { estudianteId, fichaId, fecha },
      {
        estudianteId,
        fichaId,
        fecha,
        estado,
        hora: hora || '—',
        horasTardanza: horasTardanza || 0,
        tiempoTardanza: tiempoTardanza || (horasTardanza ? `${horasTardanza} ${horasTardanza === 1 ? 'hora' : 'horas'}` : '0 horas'),
        motivoInhabilitacion: motivoInhabilitacion || '',
        instructorId: instructorId || null
      },
      { new: true, upsert: true }
    )

    if (estado !== 'Inhabilitada') {
      await Estudiante.findByIdAndUpdate(estudianteId, { estadoAsistencia: estado })
    }

    res.status(201).json(asistencia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/inhabilitar-jornada', async (req, res) => {
  try {
    const { fichaId, fecha, motivo, instructorId } = req.body
    if (!fichaId || !fecha) {
      return res.status(400).json({ error: 'fichaId y fecha son requeridos' })
    }

    const estudiantes = await Estudiante.find({ fichaId, estado: { $ne: 'Retirado' } })
    const motivoFinal = motivo || 'Jornada no impartida / Actividad institucional'

    const operaciones = estudiantes.map(est => ({
      updateOne: {
        filter: { estudianteId: est._id, fichaId, fecha },
        update: {
          $set: {
            estudianteId: est._id,
            fichaId,
            fecha,
            estado: 'Inhabilitada',
            hora: '—',
            horasTardanza: 0,
            tiempoTardanza: '0 horas',
            motivoInhabilitacion: motivoFinal,
            instructorId: instructorId || null
          }
        },
        upsert: true
      }
    }))

    if (operaciones.length > 0) {
      await Asistencia.bulkWrite(operaciones)
    }

    res.json({ ok: true, count: operaciones.length, motivo: motivoFinal })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/reactivar-jornada', async (req, res) => {
  try {
    const { fichaId, fecha } = req.body
    if (!fichaId || !fecha) {
      return res.status(400).json({ error: 'fichaId y fecha son requeridos' })
    }

    await Asistencia.deleteMany({ fichaId, fecha, estado: 'Inhabilitada' })
    res.json({ ok: true, message: 'Jornada reactivada exitosamente' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
