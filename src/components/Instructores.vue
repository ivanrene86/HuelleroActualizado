<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../services/api.js'

const toast = ref({ show: false, message: '', type: '' })
const showModal = ref(false)
const showInhabilitarModal = ref(false)
const editingId = ref(null)
const inhabilitarTarget = ref(null)
const inhabilitarMotivo = ref('')
const loading = ref(false)

const instructorForm = reactive({
  nombres: '',
  apellidos: '',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  correo: '',
  telefono: '',
  especialidad: '',
})

const instructores = ref([])

onMounted(async () => { await loadInstructores() })

async function loadInstructores() {
  try { instructores.value = await api.instructores.getAll() } catch (e) {
    showToastFn('Error al cargar instructores', 'error')
  }
}

function showToastFn(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function openCreate() {
  editingId.value = null
  Object.assign(instructorForm, {
    nombres: '', apellidos: '', tipoDocumento: 'CC', numeroDocumento: '',
    correo: '', telefono: '', especialidad: '',
  })
  showModal.value = true
}

function openEdit(instructor) {
  editingId.value = instructor._id
  Object.assign(instructorForm, instructor)
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function guardarInstructor() {
  const { nombres, apellidos, tipoDocumento, numeroDocumento, correo, telefono, especialidad } = instructorForm
  if (!nombres || !apellidos || !numeroDocumento || !correo || !telefono || !especialidad) {
    showToastFn('Completa todos los campos obligatorios', 'error')
    return
  }
  loading.value = true
  try {
    const body = { nombres, apellidos, tipoDocumento, numeroDocumento, correo, telefono, especialidad }
    if (editingId.value) {
      await api.instructores.update(editingId.value, body)
      showToastFn('Instructor actualizado correctamente')
    } else {
      body.estado = 'Activo'
      body.motivo = ''
      await api.instructores.create(body)
      showToastFn('Instructor creado correctamente')
    }
    await loadInstructores()
    closeModal()
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

function abrirInhabilitar(instructor) {
  inhabilitarTarget.value = instructor
  inhabilitarMotivo.value = ''
  showInhabilitarModal.value = true
}

async function confirmarInhabilitar() {
  if (!inhabilitarMotivo.value.trim()) {
    showToastFn('Debes ingresar un motivo para la inhabilitacion', 'error')
    return
  }
  try {
    await api.instructores.update(inhabilitarTarget.value._id, {
      estado: 'Inactivo',
      motivo: inhabilitarMotivo.value.trim(),
    })
    await loadInstructores()
    showInhabilitarModal.value = false
    showToastFn('Instructor inhabilitado correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

async function activarInstructor(instructor) {
  try {
    await api.instructores.update(instructor._id, { estado: 'Activo', motivo: '' })
    await loadInstructores()
    showToastFn('Instructor activado correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

async function eliminarInstructor(id) {
  try {
    await api.instructores.delete(id)
    await loadInstructores()
    showToastFn('Instructor eliminado correctamente')
  } catch (e) {
    showToastFn('Error: ' + e.message, 'error')
  }
}

function nombreCompleto(i) { return `${i.nombres} ${i.apellidos}` }
</script>

<template>
  <div class="page-header">
    <h1>Instructores</h1>
    <p>Gestiona los instructores y docentes del sistema</p>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Listado de Instructores</h3>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo Instructor</button>
    </div>

    <div v-if="instructores.length === 0" class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <p>No hay instructores registrados. Crea el primero usando el boton "Nuevo Instructor".</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Correo</th>
            <th>Telefono</th>
            <th>Especialidad</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in instructores" :key="i._id" :class="{ 'fila-inactivo': i.estado === 'Inactivo' }">
            <td><strong>{{ nombreCompleto(i) }}</strong></td>
            <td><span class="badge badge-primary">{{ i.tipoDocumento }}</span> {{ i.numeroDocumento }}</td>
            <td>{{ i.correo }}</td>
            <td>{{ i.telefono }}</td>
            <td><span class="badge badge-success">{{ i.especialidad }}</span></td>
            <td>
              <span class="badge" :class="i.estado === 'Activo' ? 'badge-success' : 'badge-danger'">{{ i.estado }}</span>
              <div v-if="i.estado === 'Inactivo' && i.motivo" class="motivo-texto">{{ i.motivo }}</div>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn-outline btn-sm" @click="openEdit(i)">Editar</button>
                <button v-if="i.estado === 'Activo'" class="btn btn-warning btn-sm" @click="abrirInhabilitar(i)">Inhabilitar</button>
                <button v-else class="btn btn-success btn-sm" @click="activarInstructor(i)">Activar</button>
                <button class="btn btn-danger btn-sm" @click="eliminarInstructor(i._id)">Eliminar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="showInhabilitarModal" class="modal-overlay" @click.self="showInhabilitarModal = false">
    <div class="modal">
      <h2>Inhabilitar Instructor</h2>
      <p style="color: var(--text-secondary); margin-bottom: 16px;">
        Estas a punto de inhabilitar a <strong>{{ inhabilitarTarget ? nombreCompleto(inhabilitarTarget) : '' }}</strong>.
        Esta accion impedira su acceso inmediato al sistema.
      </p>
      <div class="form-group">
        <label>Motivo de inhabilitacion</label>
        <textarea v-model="inhabilitarMotivo" rows="3" placeholder="Ej: Ya no pertenece a la institucion, termino contrato, etc." style="width: 100%; padding: 10px 12px; border: 1px solid var(--input-border); border-radius: 6px; font-size: 14px; font-family: var(--sans); resize: vertical;"></textarea>
      </div>
      <div class="btn-group" style="margin-top: 24px; justify-content: flex-end;">
        <button class="btn btn-outline" @click="showInhabilitarModal = false">Cancelar</button>
        <button class="btn btn-danger" @click="confirmarInhabilitar">Confirmar Inhabilitacion</button>
      </div>
    </div>
  </div>

  <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <h2>{{ editingId ? 'Editar Instructor' : 'Nuevo Instructor' }}</h2>
      <div class="form-grid">
        <div class="form-group"><label>Nombres</label><input v-model="instructorForm.nombres" type="text" placeholder="Nombres del instructor" /></div>
        <div class="form-group"><label>Apellidos</label><input v-model="instructorForm.apellidos" type="text" placeholder="Apellidos del instructor" /></div>
        <div class="form-group">
          <label>Tipo de Documento</label>
          <select v-model="instructorForm.tipoDocumento">
            <option value="CC">CC - Cedula de Ciudadania</option>
            <option value="CE">CE - Cedula de Extranjeria</option>
            <option value="PEP">PEP - Permiso Especial</option>
          </select>
        </div>
        <div class="form-group"><label>Numero de Documento</label><input v-model="instructorForm.numeroDocumento" type="text" placeholder="Numero de documento" /></div>
        <div class="form-group"><label>Correo Electronico</label><input v-model="instructorForm.correo" type="email" placeholder="correo@ejemplo.com" /></div>
        <div class="form-group"><label>Telefono</label><input v-model="instructorForm.telefono" type="tel" placeholder="+57 300 000 0000" /></div>
        <div class="form-group"><label>Especialidad</label><input v-model="instructorForm.especialidad" type="text" placeholder="Ej: Desarrollo de Software" /></div>
      </div>
      <div class="btn-group" style="margin-top: 24px; justify-content: flex-end;">
        <button class="btn btn-outline" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" @click="guardarInstructor" :disabled="loading">{{ loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear') + ' Instructor' }}</button>
      </div>
    </div>
  </div>

  <div v-if="toast.show" class="toast" :class="'toast-' + toast.type">{{ toast.message }}</div>
</template>
