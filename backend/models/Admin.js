import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  nombre: { type: String, default: 'Administrador' },
  rol: { type: String, default: 'Administrador' },
  telefono: { type: String, default: '' },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true, collection: 'admin' })

export default mongoose.model('Admin', adminSchema)
