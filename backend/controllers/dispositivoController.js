import crypto from 'crypto'
import bcryptjs from 'bcryptjs'
import mongoose from 'mongoose'
import Dispositivo from '../models/Dispositivo.js'
import Ficha from '../models/Ficha.js'

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

export async function getDispositivos(req, res) {
  try {
    const dispositivos = await Dispositivo.find().sort({ createdAt: -1 })
    const resultado = []
    for (const d of dispositivos) {
      const obj = d.toObject()
      delete obj.tokenHash
      const fichas = await Ficha.find({ dispositivoId: d._id }).select('codigoFicha nombrePrograma jornada aulaAsignada')
      resultado.push({ ...obj, fichas })
    }
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function asociarFichas(req, res) {
  try {
    const { id } = req.params
    const { fichaIds } = req.body

    const dispositivo = await Dispositivo.findById(id)
    if (!dispositivo) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' })
    }

    if (!Array.isArray(fichaIds)) {
      return res.status(400).json({ error: 'fichaIds debe ser un array' })
    }

    const idsValidos = fichaIds.filter((fid) => mongoose.Types.ObjectId.isValid(String(fid)))

    // La relación vive en Ficha.dispositivoId. Reasignar = actualizar ese campo;
    // si una ficha apuntaba a otro dispositivo, queda automáticamente "movida"
    // (no hay que desvincular del anterior porque no existe un array inverso).
    if (idsValidos.length > 0) {
      await Ficha.updateMany(
        { _id: { $in: idsValidos } },
        { $set: { dispositivoId: id } }
      )
    }

    const fichas = await Ficha.find({ dispositivoId: id }).select('codigoFicha nombrePrograma jornada aulaAsignada')
    const obj = dispositivo.toObject()
    delete obj.tokenHash
    res.json({ ok: true, dispositivo: obj, fichas })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
