import mongoose from 'mongoose'

const excusaSchema = new mongoose.Schema({
  estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  fichaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor', default: null },
  fechaInasistencia: { type: String, required: true },
  horasDescontar: { type: Number, default: 6 },
  tipoExcusa: { type: String, default: 'Medica' },
  motivo: { type: String, required: true },
  adjuntoNombre: { type: String, default: '' },
  adjuntoData: { type: String, default: null },
  estado: { type: String, enum: ['Pendiente', 'Aprobada', 'Rechazada'], default: 'Pendiente' },
  motivoRechazo: { type: String, default: '' },
}, { timestamps: true, collection: 'excusas' })

export default mongoose.model('Excusa', excusaSchema)
