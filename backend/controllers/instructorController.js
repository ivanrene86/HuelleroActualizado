import Instructor from '../models/Instructor.js'
import Ficha from '../models/Ficha.js'
import { hashPassword } from '../services/passwordService.js'

export async function getInstructores(req, res) {
  try {
    const instructores = await Instructor.find().sort({ createdAt: -1 })
    const fichasLideres = await Ficha.find({ instructorLiderId: { $ne: null } })
    const idsLideres = new Set(fichasLideres.map(f => String(f.instructorLiderId)))

    const resultado = instructores.map(inst => {
      const obj = inst.toObject()
      delete obj.password // No exponer el hash en la respuesta
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
}

export async function createInstructor(req, res) {
  try {
    const data = { ...req.body }
    const clavePlana = data.password || 'sena2026'
    data.password = await hashPassword(clavePlana)

    const instructor = new Instructor(data)
    await instructor.save()

    const obj = instructor.toObject()
    delete obj.password
    res.status(201).json(obj)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updateInstructor(req, res) {
  try {
    const data = { ...req.body }
    if (data.password) {
      data.password = await hashPassword(data.password)
    } else {
      delete data.password
    }

    const instructor = await Instructor.findByIdAndUpdate(req.params.id, data, { new: true })
    if (!instructor) return res.status(404).json({ error: 'Instructor no encontrado' })

    const obj = instructor.toObject()
    delete obj.password
    res.json(obj)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function deleteInstructor(req, res) {
  try {
    const instructor = await Instructor.findByIdAndDelete(req.params.id)
    if (!instructor) return res.status(404).json({ error: 'Instructor no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function importarInstructores(req, res) {
  try {
    const { instructores } = req.body
    if (!instructores || !Array.isArray(instructores)) {
      return res.status(400).json({ error: 'Se requiere un array de instructores' })
    }

    let insertados = 0
    let errores = 0

    for (const inst of instructores) {
      try {
        const existe = await Instructor.findOne({
          $or: [
            { numeroDocumento: inst.numeroDocumento },
            { correo: inst.correo }
          ]
        })

        if (!existe) {
          const clavePlana = inst.password || 'sena2026'
          const passwordHash = await hashPassword(clavePlana)
          await Instructor.create({
            ...inst,
            password: passwordHash
          })
          insertados++
        }
      } catch (err) {
        errores++
      }
    }

    res.json({ ok: true, insertados, errores })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
