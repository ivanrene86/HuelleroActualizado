import mongoose from 'mongoose'

const claseSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  fichaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor', required: true },
  estado: { type: String, enum: ['Activa', 'Finalizada'], default: 'Activa' },
  iniciadaAt: { type: Date, default: Date.now },
  finalizadaAt: { type: Date, default: null },
}, { timestamps: true, collection: 'clases' })

export default mongoose.model('Clase', claseSchema)
