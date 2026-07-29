import { Router } from 'express'
import Instructor from '../models/Instructor.js'

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

export default router
