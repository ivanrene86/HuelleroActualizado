import mongoose from 'mongoose'

const diaFestivoSchema = new mongoose.Schema({
  fecha: { type: String, required: true, unique: true },
  motivo: { type: String, enum: ['Festivo', 'Jornada Pedagogica', 'Receso'], default: 'Festivo' },
  fichasAplicables: { type: String, enum: ['todas', 'especificas'], default: 'todas' },
  fichasSeleccionadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ficha' }],
  descripcion: { type: String, default: '' },
}, { timestamps: true, collection: 'diasFestivos' })

export default mongoose.model('DiaFestivo', diaFestivoSchema)
