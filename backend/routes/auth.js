import { Router } from 'express'
import Admin from '../models/Admin.js'
import Instructor from '../models/Instructor.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' })
    }

    // 1. Buscar en Administradores
    const admin = await Admin.findOne({ correo, password })
    if (admin) {
      return res.json({
        ok: true,
        usuario: { id: admin._id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol || 'Administrador' },
        admin: { id: admin._id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol || 'Administrador' }
      })
    }

    // 2. Buscar en Instructores
    const instructor = await Instructor.findOne({ correo, password })
    if (instructor) {
      if (instructor.estado === 'Inactivo') {
        return res.status(403).json({ error: 'Tu cuenta de instructor se encuentra inactiva' })
      }
      const fichaLider = await Ficha.findOne({ instructorLiderId: instructor._id })
      const esLider = !!(instructor.esLider || fichaLider)
      const nombreCompleto = `${instructor.nombres} ${instructor.apellidos}`
      return res.json({
        ok: true,
        usuario: { id: instructor._id, nombre: nombreCompleto, correo: instructor.correo, rol: 'Instructor', esLider, rolDetallado: esLider ? 'Instructor Líder' : 'Instructor Común' },
        admin: { id: instructor._id, nombre: nombreCompleto, correo: instructor.correo, rol: 'Instructor', esLider, rolDetallado: esLider ? 'Instructor Líder' : 'Instructor Común' }
      })
    }

    // 3. Buscar en Estudiantes (por correo o número de documento)
    const estudiante = await Estudiante.findOne({
      $or: [{ correo }, { numeroDocumento: correo }]
    })
    if (estudiante) {
      if (estudiante.estado !== 'Activo') {
        return res.status(403).json({ error: `Tu cuenta de estudiante se encuentra en estado ${estudiante.estado}` })
      }
      // Contraseña del estudiante: su número de documento o la enviada
      const passCorrecta = password === estudiante.numeroDocumento || password === 'sena2026'
      if (passCorrecta) {
        const nombreCompleto = `${estudiante.nombres} ${estudiante.apellidos}`
        return res.json({
          ok: true,
          usuario: { id: estudiante._id, nombre: nombreCompleto, correo: estudiante.correo, rol: 'Estudiante', estudianteId: estudiante._id },
          admin: { id: estudiante._id, nombre: nombreCompleto, correo: estudiante.correo, rol: 'Estudiante', estudianteId: estudiante._id }
        })
      }
    }

    return res.status(401).json({ error: 'Correo/Documento o contraseña incorrectos' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/perfil', async (req, res) => {
  try {
    const admin = await Admin.findOne()
    if (!admin) return res.json(null)
    res.json({ nombre: admin.nombre, rol: admin.rol, telefono: admin.telefono, correo: admin.correo })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/perfil', async (req, res) => {
  try {
    const { nombre, telefono, correo, password } = req.body
    let admin = await Admin.findOne()
    if (!admin) {
      admin = new Admin({ nombre, telefono, correo, password: password || 'sena2026ADSO' })
    } else {
      if (nombre !== undefined) admin.nombre = nombre
      if (telefono !== undefined) admin.telefono = telefono
      if (correo !== undefined) admin.correo = correo
      if (password) admin.password = password
    }
    await admin.save()
    res.json({ ok: true, perfil: { nombre: admin.nombre, rol: admin.rol, telefono: admin.telefono, correo: admin.correo } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/recovery-code', async (req, res) => {
  try {
    const { correo } = req.body
    const admin = await Admin.findOne({ correo })
    if (!admin) {
      return res.status(404).json({ error: 'El correo no coincide con el administrador registrado' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { correo, nuevaPassword } = req.body
    const admin = await Admin.findOne({ correo })
    if (!admin) {
      return res.status(404).json({ error: 'Administrador no encontrado' })
    }
    admin.password = nuevaPassword
    await admin.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
