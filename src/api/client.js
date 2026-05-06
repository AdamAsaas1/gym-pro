import axios from 'axios'

function resolveApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL
  if (configuredUrl) return configuredUrl

  if (typeof window === 'undefined') {
    return 'http://localhost:5000'
  }

  const host = window.location.hostname
  const apiHost = host === '127.0.0.1' ? 'localhost' : host
  return `http://${apiHost}:5000`
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

async function requestWithFallback(requests) {
  let lastError = null
  for (const run of requests) {
    try {
      const response = await run()
      return response.data
    } catch (error) {
      const status = error?.response?.status
      if (status === 404) {
        lastError = error
        continue
      }
      throw error
    }
  }

  if (lastError) throw lastError
  throw new Error('No request candidates provided')
}

const TOKEN_KEYS = {
  access: 'gym_access_token',
  refresh: 'gym_refresh_token',
}

export const getAccessToken = () => localStorage.getItem(TOKEN_KEYS.access)
export const getRefreshToken = () => localStorage.getItem(TOKEN_KEYS.refresh)

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(TOKEN_KEYS.access, accessToken)
  if (refreshToken) localStorage.setItem(TOKEN_KEYS.refresh, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEYS.access)
  localStorage.removeItem(TOKEN_KEYS.refresh)
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let pendingRequests = []

function flushPendingRequests(newToken) {
  pendingRequests.forEach((cb) => cb(newToken))
  pendingRequests = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error?.response?.status

    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      clearTokens()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        pendingRequests.push((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          resolve(api(originalRequest))
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshResponse = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
      const newAccess = refreshResponse.data.access_token
      const newRefresh = refreshResponse.data.refresh_token
      setTokens({ accessToken: newAccess, refreshToken: newRefresh })
      flushPendingRequests(newAccess)
      originalRequest.headers.Authorization = `Bearer ${newAccess}`
      return api(originalRequest)
    } catch (refreshError) {
      clearTokens()
      pendingRequests = []
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginAuth = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)

export const meAuth = () => api.get('/auth/me').then((r) => r.data)

export const logoutAuth = (refreshToken) =>
  api.post('/auth/logout', { refresh_token: refreshToken }).then((r) => r.data)

// ─── Permissions ──────────────────────────────────────────────────────────────
export const getPermissionPages = () => api.get('/permissions/pages').then((r) => r.data)
export const getPermissionRoles = () => api.get('/permissions/roles').then((r) => r.data)
export const getRolePages = (role) => api.get(`/permissions/roles/${role}/pages`).then((r) => r.data)
export const updateRolePages = (role, pages) =>
  api.put(`/permissions/roles/${role}/pages`, { pages }).then((r) => r.data)

// ─── Membres ──────────────────────────────────────────────────────────────────
export const getMembres = () => requestWithFallback([
  () => api.get('/membres/'),
  () => api.get('/api/membres'),
])
export const createMembre = (data) => requestWithFallback([
  () => api.post('/membres/', data),
  () => api.post('/api/membres', data),
])
export const updateMembre = (id, d) => requestWithFallback([
  () => api.put(`/membres/${id}`, d),
  () => api.put(`/api/membres/${id}`, d),
])
export const deleteMembre = (id) => requestWithFallback([
  () => api.delete(`/membres/${id}`),
  () => api.delete(`/api/membres/${id}`),
])
export const toggleStatut = (id) => requestWithFallback([
  () => api.patch(`/membres/${id}/toggle`),
  () => api.patch(`/api/membres/${id}/toggle`),
])
export const exportMembresPDF = async () => {
  try {
    const response = await api.get('/membres/export/pdf', { responseType: 'blob' })
    return response.data
  } catch (error) {
    if (error?.response?.status !== 404) throw error
    const response = await api.get('/api/membres/export/pdf', { responseType: 'blob' })
    return response.data
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
export const getConfig     = ()      => api.get('/config').then(r => r.data)

// ─── Paiements ────────────────────────────────────────────────────────────────
export const getPaiements = () => requestWithFallback([
  () => api.get('/paiements/'),
  () => api.get('/api/paiements'),
])
export const createPaiement = (data) => requestWithFallback([
  () => api.post('/paiements/', data),
  () => api.post('/api/paiements', data),
])
export const createPaiementWorkflow = (data) => requestWithFallback([
  () => api.post('/paiements/workflow', data),
  () => api.post('/api/paiements/workflow', data),
])
export const telechargerRecu = async (id) => {
  try {
    const response = await api.get(`/paiements/${id}/recu`, { responseType: 'blob' })
    return response.data
  } catch (error) {
    if (error?.response?.status !== 404) throw error
    const response = await api.get(`/api/paiements/${id}/recu`, { responseType: 'blob' })
    return response.data
  }
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = () => api.get('/notifications').then((r) => r.data)
export const createNotification = (data) => api.post('/notifications', data).then((r) => r.data)
export const deleteNotification = (id) => api.delete(`/notifications/${id}`).then((r) => r.data)
export const getNotificationRecipients = (id) => api.get(`/notifications/${id}/recipients`).then((r) => r.data)

export default api
