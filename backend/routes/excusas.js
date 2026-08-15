import { Router } from 'express'
import Excusa from '../models/Excusa.js'
import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { estado, fichaId } = req.query
    const filter = {}
    if (estado) filter.estado = estado
    if (fichaId) filter.fichaId = fichaId
    const excusas = await Excusa.find(filter).sort({ createdAt: -1 })
    res.json(excusas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const excusa = new Excusa(req.body)
    await excusa.save()
    res.status(201).json(excusa)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const excusa = await Excusa.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })
    res.json(excusa)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/aprobar', async (req, res) => {
  try {
    const excusa = await Excusa.findById(req.params.id)
    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })

    excusa.estado = 'Aprobada'
    await excusa.save()

    let asistencia = await Asistencia.findOne({
      estudianteId: excusa.estudianteId,
      fecha: excusa.fechaInasistencia,
      fichaId: excusa.fichaId,
    })

    if (asistencia) {
      asistencia.estado = 'Excusada'
      await asistencia.save()
    } else {
      asistencia = new Asistencia({
        estudianteId: excusa.estudianteId,
        fichaId: excusa.fichaId,
        fecha: excusa.fechaInasistencia,
        estado: 'Excusada',
        hora: '—',
      })
      await asistencia.save()
    }

    await Estudiante.findByIdAndUpdate(excusa.estudianteId, { estadoAsistencia: 'Excusada' })

    res.json({ ok: true, excusa })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/rechazar', async (req, res) => {
  try {
    const { motivoRechazo } = req.body
    const excusa = await Excusa.findById(req.params.id)
    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })

    excusa.estado = 'Rechazada'
    excusa.motivoRechazo = motivoRechazo || ''
    await excusa.save()

    res.json({ ok: true, excusa })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
