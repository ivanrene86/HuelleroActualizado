<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const loading = ref(false)

const userStr = sessionStorage.getItem('user_data')
const usuarioSesion = ref(userStr ? JSON.parse(userStr) : null)

const esInstructor = computed(() => usuarioSesion.value?.rol === 'Instructor')

const perfil = reactive({
  id: '',
  nombre: '',
  nombres: '',
  apellidos: '',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  correo: '',
  telefono: '',
  especialidad: '',
  rol: '',
  estado: 'Activo',
})

const password = ref('')
const confirmPassword = ref('')

const esLiderCalculado = ref(false)

onMounted(async () => {
  if (usuarioSesion.value) {
    perfil.id = usuarioSesion.value.id || ''
    perfil.rol = usuarioSesion.value.rol || 'Usuario'
    perfil.nombre = usuarioSesion.value.nombre || ''
    perfil.correo = usuarioSesion.value.correo || ''
  }

  if (esInstructor.value && perfil.id) {
    try {
      const [instructores, misFichas] = await Promise.all([
        api.instructores.getAll(),
        api.fichas.getMisFichas(perfil.id).catch(() => [])
      ])
      const inst = instructores.find(i => String(i._id) === String(perfil.id) || i.correo === perfil.correo)
      if (inst) {
        perfil.id = inst._id
        perfil.nombres = inst.nombres || ''
        perfil.apellidos = inst.apellidos || ''
        perfil.nombre = `${inst.nombres || ''} ${inst.apellidos || ''}`.trim() || perfil.nombre
        perfil.tipoDocumento = inst.tipoDocumento || 'CC'
        perfil.numeroDocumento = inst.numeroDocumento || ''
        perfil.correo = inst.correo || perfil.correo
        perfil.telefono = inst.telefono || ''
        perfil.especialidad = inst.especialidad || 'Docente SENA'
        perfil.estado = inst.estado || 'Activo'

        const esLiderEnFicha = misFichas.some(f => f.esLider || String(f.instructorLiderId?._id || f.instructorLiderId) === String(inst._id))
        esLiderCalculado.value = !!(inst.esLider || esLiderEnFicha || usuarioSesion.value?.esLider)
      }
    } catch (e) {
      console.error('Error al cargar datos del instructor:', e)
    }
  } else {
    try {
      const data = await api.auth.getPerfil()
      if (data) {
        perfil.nombre = data.nombre || perfil.nombre
        perfil.rol = data.rol || perfil.rol
        perfil.telefono = data.telefono || ''
        perfil.correo = data.correo || perfil.correo
      }
    } catch (e) {
      console.error('Error al cargar perfil de admin:', e)
    }
  }
})

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

async function guardarPerfil() {
  if (password.value && password.value !== confirmPassword.value) {
    showToast('Las contraseñas no coinciden', 'error')
    return
  }

  loading.value = true
  try {
    if (esInstructor.value && perfil.id) {
      const body = {
        nombres: perfil.nombres || perfil.nombre,
        apellidos: perfil.apellidos,
        telefono: perfil.telefono,
        correo: perfil.correo,
        especialidad: perfil.especialidad,
      }
      if (password.value) body.password = password.value

      await api.instructores.update(perfil.id, body)
      
      // Actualizar sesión
      const updatedUser = { ...usuarioSesion.value, nombre: `${perfil.nombres} ${perfil.apellidos}`.trim(), correo: perfil.correo }
      sessionStorage.setItem('user_data', JSON.stringify(updatedUser))
      
      password.value = ''
      confirmPassword.value = ''
      showToast('Perfil de instructor actualizado correctamente')
    } else {
      const body = {
        nombre: perfil.nombre,
        telefono: perfil.telefono,
        correo: perfil.correo,
      }
      if (password.value) body.password = password.value

      const res = await api.auth.updatePerfil(body)
      if (res.ok) {
        Object.assign(perfil, res.perfil)
        password.value = ''
        confirmPassword.value = ''
        showToast('Perfil de administrador actualizado correctamente')
      }
    }
  } catch (e) {
    showToast('Error al guardar perfil: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-header">
    <h1>{{ esInstructor ? '👨‍🏫 Perfil del Instructor / Maestro' : '⚙️ Perfil del Administrador' }}</h1>
    <p>{{ esInstructor ? 'Información personal y académica del docente' : 'Gestiona tu información personal de administrador' }}</p>
  </div>

  <!-- Vista para Instructor / Maestro -->
  <div v-if="esInstructor" class="card">
    <div class="card-header">
      <h3>Datos Personales del Instructor</h3>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Nombres</label>
        <input v-model="perfil.nombres" type="text" placeholder="Nombres" />
      </div>
      <div class="form-group">
        <label>Apellidos</label>
        <input v-model="perfil.apellidos" type="text" placeholder="Apellidos" />
      </div>
      <div class="form-group">
        <label>Tipo Documento</label>
        <input :value="perfil.tipoDocumento" type="text" disabled />
      </div>
      <div class="form-group">
        <label>Número Documento</label>
        <input :value="perfil.numeroDocumento" type="text" disabled />
      </div>
      <div class="form-group">
        <label>Especialidad / Área</label>
        <input v-model="perfil.especialidad" type="text" placeholder="Ej. Desarrollo de Software" />
      </div>
      <div class="form-group">
        <label>Rol en el Sistema</label>
        <input :value="perfil.rol" type="text" disabled />
      </div>
      <div class="form-group">
        <label>Correo Electrónico</label>
        <input v-model="perfil.correo" type="email" placeholder="correo@sena.edu.co" />
      </div>
      <div class="form-group">
        <label>Número de Teléfono</label>
        <input v-model="perfil.telefono" type="tel" placeholder="+57 300 000 0000" />
      </div>
      <div class="form-group">
        <label>Nueva Contraseña</label>
        <input v-model="password" type="password" placeholder="Dejar vacío para mantener la actual" />
      </div>
      <div class="form-group">
        <label>Confirmar Contraseña</label>
        <input v-model="confirmPassword" type="password" placeholder="Repite la contraseña" />
      </div>
    </div>
    <div style="margin-top: 24px">
      <button class="btn btn-primary" @click="guardarPerfil" :disabled="loading">
        {{ loading ? 'Guardando...' : '💾 Guardar Cambios' }}
      </button>
    </div>
  </div>

  <!-- Vista para Administrador -->
  <div v-else class="card">
    <div class="card-header">
      <h3>Información Personal</h3>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Nombre</label>
        <input v-model="perfil.nombre" type="text" placeholder="Tu nombre completo" />
      </div>
      <div class="form-group">
        <label>Rol</label>
        <input :value="perfil.rol" type="text" disabled />
      </div>
      <div class="form-group">
        <label>Número de Teléfono</label>
        <input v-model="perfil.telefono" type="tel" placeholder="+57 300 000 0000" />
      </div>
      <div class="form-group">
        <label>Correo Electrónico</label>
        <input v-model="perfil.correo" type="email" placeholder="admin@correo.com" />
      </div>
      <div class="form-group">
        <label>Nueva Contraseña</label>
        <input v-model="password" type="password" placeholder="Dejar vacío para no cambiar" />
      </div>
      <div class="form-group">
        <label>Confirmar Contraseña</label>
        <input v-model="confirmPassword" type="password" placeholder="Repite la contraseña" />
      </div>
    </div>
    <div style="margin-top: 24px">
      <button class="btn btn-primary" @click="guardarPerfil" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
      </button>
    </div>
  </div>

  <!-- Resumen del Perfil -->
  <div class="card">
    <div class="card-header">
      <h3>Resumen del Perfil</h3>
    </div>
    <div class="profile-info">
      <div class="profile-field">
        <label>Nombre Completo</label>
        <div class="value">{{ (perfil.nombres ? `${perfil.nombres} ${perfil.apellidos}` : perfil.nombre) || '—' }}</div>
      </div>
      <div class="profile-field" v-if="esInstructor">
        <label>Documento de Identidad</label>
        <div class="value">{{ perfil.tipoDocumento }} {{ perfil.numeroDocumento || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Rol en la Institución</label>
        <div class="value">
          <template v-if="esInstructor">
            <span class="badge" :class="esLiderCalculado ? 'badge-primary' : 'badge-neutral'" style="font-size: 13px; padding: 4px 10px; font-weight: 600;">
              {{ esLiderCalculado ? '👥 Instructor Líder' : '👨‍🏫 Instructor Común' }}
            </span>
          </template>
          <template v-else>
            <span class="badge badge-primary" style="font-size: 13px; padding: 4px 10px;">{{ perfil.rol }}</span>
          </template>
        </div>
      </div>
      <div class="profile-field" v-if="esInstructor">
        <label>Especialidad</label>
        <div class="value">{{ perfil.especialidad || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Teléfono</label>
        <div class="value">{{ perfil.telefono || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Correo Electrónico</label>
        <div class="value">{{ perfil.correo || '—' }}</div>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">
    {{ toast.message }}
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
}
.page-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}
.page-header p {
  color: #64748b;
  font-size: 14px;
}
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}
.card-header {
  margin-bottom: 20px;
}
.card-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}
.form-group input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
}
.form-group input:disabled {
  background: #f8fafc;
  color: #64748b;
}
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
}
.btn-primary {
  background: #2563eb;
  color: white;
}
.profile-info {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.profile-field label {
  font-size: 12px;
  color: #64748b;
  display: block;
  margin-bottom: 4px;
}
.profile-field .value {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  color: white;
  z-index: 9999;
}
.toast-success { background: #16a34a; }
.toast-error { background: #dc2626; }
</style>
