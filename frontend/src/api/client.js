import axios from 'axios'
import { toast } from 'sonner'
import { clearCache, getCached, setCache } from './cache'

const API_BASE_URL = window.location.origin

// ponytail: anonymous session — UUID v4 in localStorage, auto-injected on every request.
// Upgrade path: swap for JWT/auth when login is added.
function getSessionId() {
  let id = localStorage.getItem('session_id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    id = crypto.randomUUID()
    localStorage.setItem('session_id', id)
  }
  return id
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Inject session header on every outbound request
api.interceptors.request.use((config) => {
  config.headers['X-Session-Id'] = getSessionId()
  return config
})

// Global error handler: toast + normalized message
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || 'Something went wrong'
    // Only toast for non-429 (rate limit) errors — callers handle 429 via toast themselves
    if (err.response?.status !== 429) {
      toast.error(msg)
    }
    return Promise.reject(new Error(msg))
  }
)

export const searchJobs = async (query, location = '', source = 'both', limit = 10) => {
  const response = await api.post('/api/search-jobs', {
    query,
    location,
    source,
    limit
  })
  return response.data
}

export const uploadCV = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/api/upload-cv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  clearCache('cvs_list')
  return response.data
}

export const loadDemoCV = async () => {
  const response = await api.post('/api/demo')
  clearCache('cvs_list')
  return response.data
}

export const getCVs = async () => {
  const cached = getCached('cvs_list', 60000) // 1 min cache
  if (cached) return cached
  const response = await api.get('/api/cvs')
  setCache('cvs_list', response.data)
  return response.data
}

export const getCV = async (cvId) => {
  const response = await api.get(`/api/cvs/${cvId}`)
  return response.data
}

export const matchJobs = async (cvId, query, location = '', source = 'jobstreet', topN = 10, offset = 0, matchMode = 'skills', sortBy = 'relevance') => {
  const response = await api.post(`/api/match-jobs/${cvId}`, {
    query,
    location,
    source,
    top_n: topN,
    offset,
    match_mode: matchMode,
    sort_by: sortBy
  })
  return response.data
}

export const analyzeJobFit = async (cvId, jobUrl) => {
  const response = await api.post(`/api/analyze-job-fit/${cvId}`, {
    job_url: jobUrl
  })
  return response.data
}

export const optimizeCV = async (cvId, jobData) => {
  const response = await api.post(`/api/optimize-cv/${cvId}`, {
    job_title: jobData.title || jobData.job_title || '',
    job_description: jobData.description || jobData.summary || '',
    company: jobData.company || '',
    job_url: jobData.url || ''
  })
  return response.data
}

export const generateTailoredCV = async (cvId, payload) => {
  const response = await api.post(`/api/generate-tailored-cv/${cvId}`, payload)
  return response.data
}

export const downloadGeneratedCVUrl = (filename) => {
  return `${API_BASE_URL}/api/download-generated-cv/${encodeURIComponent(filename)}`
}

export const downloadCVUrl = (cvId) => {
  // ponytail: blob download via fetch to inject session header.
  // <embed>/<iframe> can't send custom headers — use blob URL instead.
  return `${API_BASE_URL}/api/download-cv/${cvId}`
}

export { getSessionId }

export default api
