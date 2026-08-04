import { Router } from 'express'
import Instructor from '../models/Instructor.js'
import Ficha from '../models/Ficha.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const instructores = await Instructor.find().sort({ createdAt: -1 })
    res.json(instructores)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const instructor = new Instructor(req.body)
    await instructor.save()
    res.status(201).json(instructor)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!instructor) return res.status(404).json({ error: 'Instructor no encontrado' })
    res.json(instructor)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndDelete(req.params.id)
    if (!instructor) return res.status(404).json({ error: 'Instructor no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/importar', async (req, res) => {
  try {
    const { instructores } = req.body
    if (!instructores || !Array.isArray(instructores)) {
      return res.status(400).json({ error: 'Se requiere un array de instructores' })
    }

    let creados = 0
    for (const instData of instructores) {
      const { fichaId, esLider, ...rest } = instData
      const instructor = new Instructor(rest)
      await instructor.save()
      creados++

      if (fichaId) {
        if (esLider) {
          await Ficha.findByIdAndUpdate(fichaId, { instructorLiderId: instructor._id })
        } else {
          await Ficha.findByIdAndUpdate(fichaId, { $addToSet: { instructores: instructor._id } })
        }
      }
    }

    res.status(201).json({ ok: true, count: creados })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
