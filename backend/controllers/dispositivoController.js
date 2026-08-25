import crypto from 'crypto'
import bcryptjs from 'bcryptjs'
import Dispositivo from '../models/Dispositivo.js'

export async function registrar(req, res) {
  try {
    const { nombre } = req.body

    const deviceId = crypto.randomUUID()
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = await bcryptjs.hash(token, 10)

    await Dispositivo.create({
      deviceId,
      tokenHash,
      nombre: nombre || '',
      activo: true,
    })

    // Este es el ÚNICO momento en que el token viaja en texto plano:
    // el backend lo entrega aquí y nunca vuelve a exponerlo ni puede recuperarlo;
    // a futuro solo puede compararse contra tokenHash (bcryptjs).
    res.status(201).json({ deviceId, token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
