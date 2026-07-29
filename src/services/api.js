const BASE = 'http://localhost:3000/api'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error del servidor')
  return data
}

export default {
  auth: {
    login(correo, password) {
      return request('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) })
    },
    getPerfil() {
      return request('/auth/perfil')
    },
    updatePerfil(body) {
      return request('/auth/perfil', { method: 'PUT', body: JSON.stringify(body) })
    },
    checkRecoveryEmail(correo) {
      return request('/auth/recovery-code', { method: 'POST', body: JSON.stringify({ correo }) })
    },
    resetPassword(correo, nuevaPassword) {
      return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ correo, nuevaPassword }) })
    },
  },

  instructores: {
    getAll() { return request('/instructores') },
    create(body) { return request('/instructores', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/instructores/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/instructores/${id}`, { method: 'DELETE' }) },
  },

  fichas: {
    getAll() { return request('/fichas') },
    getMisFichas(instructorId) { return request(`/fichas/mis-fichas/${instructorId}`) },
    create(body) { return request('/fichas', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/fichas/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/fichas/${id}`, { method: 'DELETE' }) },
  },

  estudiantes: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/estudiantes${query ? '?' + query : ''}`)
    },
    create(body) { return request('/estudiantes', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/estudiantes/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    enrolarHuella(id, huellaTemplate) { return request(`/estudiantes/${id}/enrolar-huella`, { method: 'PUT', body: JSON.stringify({ huellaTemplate }) }) },
    delete(id) { return request(`/estudiantes/${id}`, { method: 'DELETE' }) },
    importar(estudiantes) { return request('/estudiantes/importar', { method: 'POST', body: JSON.stringify({ estudiantes }) }) },
  },

  excusas: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/excusas${query ? '?' + query : ''}`)
    },
    create(body) { return request('/excusas', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/excusas/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    aprobar(id) { return request(`/excusas/${id}/aprobar`, { method: 'PUT' }) },
    rechazar(id, motivoRechazo) { return request(`/excusas/${id}/rechazar`, { method: 'PUT', body: JSON.stringify({ motivoRechazo }) }) },
  },

  asistencias: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/asistencias${query ? '?' + query : ''}`)
    },
    create(body) { return request('/asistencias', { method: 'POST', body: JSON.stringify(body) }) },
  },

  diasFestivos: {
    getAll() { return request('/dias-festivos') },
    create(body) { return request('/dias-festivos', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/dias-festivos/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/dias-festivos/${id}`, { method: 'DELETE' }) },
  },
}
