import { Router } from 'express'
import Instructor from '../models/Instructor.js'
import Ficha from '../models/Ficha.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const instructores = await Instructor.find().sort({ createdAt: -1 })
    const fichasLideres = await Ficha.find({ instructorLiderId: { $ne: null } })
    const idsLideres = new Set(fichasLideres.map(f => String(f.instructorLiderId)))

    const resultado = instructores.map(inst => {
      const obj = inst.toObject()
      const esLiderEnFicha = idsLideres.has(String(inst._id))
      return {
        ...obj,
        esLider: !!(inst.esLider || esLiderEnFicha)
      }
    })

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = {
      password: 'sena2026',
      rol: 'Instructor',
      ...req.body
    }
    if (!data.password) data.password = 'sena2026'

    const instructor = new Instructor(data)
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
      if (!rest.password) rest.password = 'sena2026'
      if (!rest.rol) rest.rol = 'Instructor'

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
