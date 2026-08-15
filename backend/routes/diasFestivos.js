import { Router } from 'express'
import DiaFestivo from '../models/DiaFestivo.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const dias = await DiaFestivo.find().sort({ fecha: 1 })
    res.json(dias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const dia = new DiaFestivo(req.body)
    await dia.save()
    res.status(201).json(dia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const dia = await DiaFestivo.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!dia) return res.status(404).json({ error: 'Dia festivo no encontrado' })
    res.json(dia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const dia = await DiaFestivo.findByIdAndDelete(req.params.id)
    if (!dia) return res.status(404).json({ error: 'Dia festivo no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
