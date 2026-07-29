import { Router } from 'express'
import Estudiante from '../models/Estudiante.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { fichaId, documento, nombres, estado } = req.query
    const filter = {}
    if (fichaId) filter.fichaId = fichaId
    if (estado) filter.estado = estado
    if (documento) filter.numeroDocumento = { $regex: documento, $options: 'i' }
    if (nombres) {
      filter.$or = [
        { nombres: { $regex: nombres, $options: 'i' } },
        { apellidos: { $regex: nombres, $options: 'i' } },
      ]
    }
    const estudiantes = await Estudiante.find(filter).sort({ createdAt: -1 })
    res.json(estudiantes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const estudiante = new Estudiante(req.body)
    await estudiante.save()
    res.status(201).json(estudiante)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/enrolar-huella', async (req, res) => {
  try {
    const { huellaTemplate } = req.body
    const estudiante = await Estudiante.findByIdAndUpdate(
      req.params.id,
      {
        huellaEnrolada: true,
        huellaTemplate: huellaTemplate || `TEMPLATE_HUELLA_${Date.now()}`,
        fechaEnrolamiento: new Date().toISOString().split('T')[0]
      },
      { new: true }
    )
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json({ ok: true, estudiante })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json(estudiante)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findByIdAndDelete(req.params.id)
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/importar', async (req, res) => {
  try {
    const { estudiantes } = req.body
    if (!estudiantes || !Array.isArray(estudiantes)) {
      return res.status(400).json({ error: 'Se requiere un array de estudiantes' })
    }
    const result = await Estudiante.insertMany(estudiantes)
    res.status(201).json({ ok: true, count: result.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
