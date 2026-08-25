import Ficha from '../models/Ficha.js'

export async function getFichas(req, res) {
  try {
    const { instructorId } = req.query
    const filter = {}
    if (instructorId) {
      filter.$or = [
        { instructorLiderId: instructorId },
        { instructores: instructorId }
      ]
    }
    const fichas = await Ficha.find(filter)
      .populate('instructorLiderId', 'nombres apellidos correo')
      .populate('instructores', 'nombres apellidos correo')
      .sort({ createdAt: -1 })
    res.json(fichas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function getMisFichas(req, res) {
  try {
    const { instructorId } = req.params
    const fichas = await Ficha.find({
      $or: [
        { instructorLiderId: instructorId },
        { instructores: instructorId }
      ]
    })
      .populate('instructorLiderId', 'nombres apellidos correo')
      .populate('instructores', 'nombres apellidos correo')
      .sort({ createdAt: -1 })

    const resultado = fichas.map(f => {
      const liderIdStr = f.instructorLiderId ? String(f.instructorLiderId._id || f.instructorLiderId) : ''
      const esLider = liderIdStr === String(instructorId)
      return {
        ...f.toObject(),
        esLider
      }
    })

    res.json(resultado)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function createFicha(req, res) {
  try {
    const ficha = new Ficha(req.body)
    await ficha.save()
    const populated = await ficha
      .populate('instructorLiderId', 'nombres apellidos correo')
    await populated.populate('instructores', 'nombres apellidos correo')
    res.status(201).json(populated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updateFicha(req, res) {
  try {
    const ficha = await Ficha.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('instructorLiderId', 'nombres apellidos correo')
      .populate('instructores', 'nombres apellidos correo')
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.json(ficha)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function deleteFicha(req, res) {
  try {
    const ficha = await Ficha.findByIdAndDelete(req.params.id)
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function importarFichas(req, res) {
  try {
    const { fichas } = req.body
    if (!fichas || !Array.isArray(fichas)) {
      return res.status(400).json({ error: 'Se requiere un array de fichas' })
    }
    const result = await Ficha.insertMany(fichas)
    res.status(201).json({ ok: true, count: result.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
