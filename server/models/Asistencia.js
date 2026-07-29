import mongoose from 'mongoose'

const asistenciaSchema = new mongoose.Schema({
  estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  fichaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true },
  fecha: { type: String, required: true },
  estado: { type: String, enum: ['Presente', 'Tardanza', 'Falta', 'Excusada'], required: true },
  hora: { type: String, default: '—' },
}, { timestamps: true, collection: 'asistencias' })

export default mongoose.model('Asistencia', asistenciaSchema)
