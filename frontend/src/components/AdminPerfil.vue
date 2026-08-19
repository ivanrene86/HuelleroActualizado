<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import api from '../services/api.js'
import './adminPerfil.css'

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
  <div class="admin-profile-page-header">
    <h1>{{ esInstructor ? '👨‍🏫 Perfil del Instructor / Maestro' : '⚙️ Perfil del Administrador' }}</h1>
    <p>{{ esInstructor ? 'Información personal y académica del docente' : 'Gestiona tu información personal de administrador' }}</p>
  </div>

  <!-- Vista para Instructor / Maestro -->
  <div v-if="esInstructor" class="admin-profile-card">
    <div class="admin-profile-card-header">
      <h3>Datos Personales del Instructor</h3>
    </div>
    <div class="admin-profile-form-grid">
      <div class="admin-profile-form-group">
        <label>Nombres</label>
        <input v-model="perfil.nombres" type="text" placeholder="Nombres" />
      </div>
      <div class="admin-profile-form-group">
        <label>Apellidos</label>
        <input v-model="perfil.apellidos" type="text" placeholder="Apellidos" />
      </div>
      <div class="admin-profile-form-group">
        <label>Tipo Documento</label>
        <input :value="perfil.tipoDocumento" type="text" disabled />
      </div>
      <div class="admin-profile-form-group">
        <label>Número Documento</label>
        <input :value="perfil.numeroDocumento" type="text" disabled />
      </div>
      <div class="admin-profile-form-group">
        <label>Especialidad / Área</label>
        <input v-model="perfil.especialidad" type="text" placeholder="Ej. Desarrollo de Software" />
      </div>
      <div class="admin-profile-form-group">
        <label>Rol en el Sistema</label>
        <input :value="perfil.rol" type="text" disabled />
      </div>
      <div class="admin-profile-form-group">
        <label>Correo Electrónico</label>
        <input v-model="perfil.correo" type="email" placeholder="correo@sena.edu.co" />
      </div>
      <div class="admin-profile-form-group">
        <label>Número de Teléfono</label>
        <input v-model="perfil.telefono" type="tel" placeholder="+57 300 000 0000" />
      </div>
      <div class="admin-profile-form-group">
        <label>Nueva Contraseña</label>
        <input v-model="password" type="password" placeholder="Dejar vacío para mantener la actual" />
      </div>
      <div class="admin-profile-form-group">
        <label>Confirmar Contraseña</label>
        <input v-model="confirmPassword" type="password" placeholder="Repite la contraseña" />
      </div>
    </div>
    <div style="margin-top: 24px">
      <button class="admin-profile-button admin-profile-button-primary" @click="guardarPerfil" :disabled="loading">
        {{ loading ? 'Guardando...' : '💾 Guardar Cambios' }}
      </button>
    </div>
  </div>

  <!-- Vista para Administrador -->
  <div v-else class="admin-profile-card">
    <div class="admin-profile-card-header">
      <h3>Información Personal</h3>
    </div>
    <div class="admin-profile-form-grid">
      <div class="admin-profile-form-group">
        <label>Nombre</label>
        <input v-model="perfil.nombre" type="text" placeholder="Tu nombre completo" />
      </div>
      <div class="admin-profile-form-group">
        <label>Rol</label>
        <input :value="perfil.rol" type="text" disabled />
      </div>
      <div class="admin-profile-form-group">
        <label>Número de Teléfono</label>
        <input v-model="perfil.telefono" type="tel" placeholder="+57 300 000 0000" />
      </div>
      <div class="admin-profile-form-group">
        <label>Correo Electrónico</label>
        <input v-model="perfil.correo" type="email" placeholder="admin@correo.com" />
      </div>
      <div class="admin-profile-form-group">
        <label>Nueva Contraseña</label>
        <input v-model="password" type="password" placeholder="Dejar vacío para no cambiar" />
      </div>
      <div class="admin-profile-form-group">
        <label>Confirmar Contraseña</label>
        <input v-model="confirmPassword" type="password" placeholder="Repite la contraseña" />
      </div>
    </div>
    <div style="margin-top: 24px">
      <button class="admin-profile-button admin-profile-button-primary" @click="guardarPerfil" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
      </button>
    </div>
  </div>

  <!-- Resumen del Perfil -->
  <div class="admin-profile-card">
    <div class="admin-profile-card-header">
      <h3>Resumen del Perfil</h3>
    </div>
    <div class="admin-profile-info">
      <div class="admin-profile-field">
        <label>Nombre Completo</label>
        <div class="admin-profile-value">{{ (perfil.nombres ? `${perfil.nombres} ${perfil.apellidos}` : perfil.nombre) || '—' }}</div>
      </div>
      <div class="admin-profile-field" v-if="esInstructor">
        <label>Documento de Identidad</label>
        <div class="admin-profile-value">{{ perfil.tipoDocumento }} {{ perfil.numeroDocumento || '—' }}</div>
      </div>
      <div class="admin-profile-field">
        <label>Rol en la Institución</label>
        <div class="admin-profile-value">
          <template v-if="esInstructor">
            <span class="admin-profile-badge" :class="esLiderCalculado ? 'admin-profile-badge-primary' : 'admin-profile-badge-neutral'" style="font-size: 13px; padding: 4px 10px; font-weight: 600;">
              {{ esLiderCalculado ? '👥 Instructor Líder' : '👨‍🏫 Instructor Común' }}
            </span>
          </template>
          <template v-else>
            <span class="admin-profile-badge admin-profile-badge-primary" style="font-size: 13px; padding: 4px 10px;">{{ perfil.rol }}</span>
          </template>
        </div>
      </div>
      <div class="admin-profile-field" v-if="esInstructor">
        <label>Especialidad</label>
        <div class="admin-profile-value">{{ perfil.especialidad || '—' }}</div>
      </div>
      <div class="admin-profile-field">
        <label>Teléfono</label>
        <div class="admin-profile-value">{{ perfil.telefono || '—' }}</div>
      </div>
      <div class="admin-profile-field">
        <label>Correo Electrónico</label>
        <div class="admin-profile-value">{{ perfil.correo || '—' }}</div>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="admin-profile-toast" :class="'admin-profile-toast-' + toast.type">
    {{ toast.message }}
  </div>
</template>

