import mongoose from 'mongoose'

const asistenciaSchema = new mongoose.Schema({
  estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  fichaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true },
  fecha: { type: String, required: true },
  estado: { type: String, enum: ['Presente', 'Tardanza', 'Falta', 'Excusada', 'Inhabilitada'], required: true },
  hora: { type: String, default: '—' },
  horasTardanza: { type: Number, default: 0 },
  tiempoTardanza: { type: String, default: '0 horas' },
  motivoInhabilitacion: { type: String, default: '' },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' },
  uuid: { type: String, index: { unique: true, sparse: true } },
  metodo: { type: String, enum: ['HUELLA', 'MANUAL'], default: 'HUELLA' },
}, { timestamps: true, collection: 'asistencias' })

export default mongoose.model('Asistencia', asistenciaSchema)
