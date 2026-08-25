import mongoose from 'mongoose'

const dispositivoSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  nombre: { type: String, default: '' },
  activo: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  // fichas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ficha' }]  // asociación dispositivo↔ficha pendiente (dashboard Admin)
}, { collection: 'dispositivos' })

export default mongoose.model('Dispositivo', dispositivoSchema)
