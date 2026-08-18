import { Router } from 'express'
import Admin from '../models/Admin.js'

const router = Router()

router.get('/perfil', async (req, res) => {
  try {
    const admin = await Admin.findOne().select('-password')
    if (!admin) return res.status(404).json({ error: 'Admin no encontrado' })
    res.json(admin)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/perfil', async (req, res) => {
  try {
    const { nombre, telefono, correo, password } = req.body
    let admin = await Admin.findOne()
    if (!admin) admin = new Admin({})

    if (nombre !== undefined) admin.nombre = nombre
    if (telefono !== undefined) admin.telefono = telefono
    if (correo !== undefined) admin.correo = correo
    if (password) admin.password = password

    await admin.save()

    const perfil = admin.toObject()
    delete perfil.password
    res.json({ ok: true, perfil })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
