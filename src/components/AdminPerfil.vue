<script setup>
import { reactive, ref, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const loading = ref(false)

const perfil = reactive({
  nombre: 'Administrador',
  rol: 'Administrador',
  telefono: '',
  correo: '',
})

const password = ref('')
const confirmPassword = ref('')

onMounted(async () => {
  try {
    const data = await api.auth.getPerfil()
    if (data) Object.assign(perfil, data)
  } catch (e) {
    showToast('Error al cargar perfil', 'error')
  }
})

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

async function guardarPerfil() {
  if (password.value && password.value !== confirmPassword.value) {
    showToast('Las contrasenas no coinciden', 'error')
    return
  }

  loading.value = true
  try {
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
      showToast('Perfil actualizado correctamente')
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
    <h1>Perfil del Administrador</h1>
    <p>Gestiona tu informacion personal</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Informacion Personal</h3>
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
        <label>Numero de Telefono</label>
        <input v-model="perfil.telefono" type="tel" placeholder="+57 300 000 0000" />
      </div>
      <div class="form-group">
        <label>Correo Electronico</label>
        <input v-model="perfil.correo" type="email" placeholder="admin@correo.com" />
      </div>
      <div class="form-group">
        <label>Nueva Contrasena</label>
        <input v-model="password" type="password" placeholder="Dejar vacio para no cambiar" />
      </div>
      <div class="form-group">
        <label>Confirmar Contrasena</label>
        <input v-model="confirmPassword" type="password" placeholder="Repite la contrasena" />
      </div>
    </div>
    <div style="margin-top: 24px">
      <button class="btn btn-primary" @click="guardarPerfil" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar Cambios' }}
      </button>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Resumen del Perfil</h3>
    </div>
    <div class="profile-info">
      <div class="profile-field">
        <label>Nombre</label>
        <div class="value">{{ perfil.nombre || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Rol</label>
        <div class="value">{{ perfil.rol || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Telefono</label>
        <div class="value">{{ perfil.telefono || '—' }}</div>
      </div>
      <div class="profile-field">
        <label>Correo Electronico</label>
        <div class="value">{{ perfil.correo || '—' }}</div>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">
    {{ toast.message }}
  </div>
</template>
