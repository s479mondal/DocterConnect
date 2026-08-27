import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000 // 60s to accommodate Render free tier cold starts
});

let isWarmupInitiated = false;

// Warmup helper to asynchronously wake up all backend services on app mount
export const warmupServers = () => {
  if (isWarmupInitiated) return Promise.resolve();
  isWarmupInitiated = true;
  return axios.get(`${API_BASE_URL}/warmup`, { timeout: 35000 }).catch(() => {
    // Non-blocking silent background catch
  });
};

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor - handle errors and auto-retry on Render cold starts (502/503/504/429)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // If it's a 502/503/504 (gateway waiting for waking microservice) or 429 (Render platform cold start block) and not retried yet
    if (error.response && [502, 503, 504, 429].includes(error.response.status) && config && !config._retry) {
      config._retry = true;
      // Wait 3 seconds for downstream container to boot, then retry once
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return api(config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (data) => api.post('/auth/google', data),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data)
};

// Doctor API
export const doctorAPI = {
  getAll: (params) => api.get('/doctors', { params }),
  search: (params) => api.get('/doctors/search', { params }),
  getById: (id) => api.get(`/doctors/${id}`),
  getByUserId: (userId) => api.get(`/doctors/user/${userId}`),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  getSpecializations: () => api.get('/doctors/specializations')
};

// Appointment API
export const appointmentAPI = {
  book: (data) => api.post('/appointments', data),
  getPatientAppointments: (params) => api.get('/appointments/patient', { params }),
  getDoctorAppointments: (doctorId, params) => api.get(`/appointments/doctor/${doctorId}`, { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  lockSlot: (data) => api.post('/appointments/lock', data),
  releaseLock: (slotId) => api.post('/appointments/release-lock', { slotId }),
  updateStatus: (id, data) => api.patch(`/appointments/${id}/status`, data),
  getAvailableSlots: (params) => api.get('/appointments/slots', { params }),
  getAvailabilitySummary: (doctorId) => api.get('/appointments/availability-summary', { params: { doctorId } }),
  createOrder: (data) => api.post('/appointments/create-order', data),
  verifyPayment: (id, data) => api.post(`/appointments/verify-payment/${id}`, data),
  addPrescription: (id, data) => api.put(`/appointments/${id}/prescription`, data)
};

// Notification API
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  getUnreadCount: () => api.get('/notifications/unread-count')
};

// Admin API
export const adminAPI = {
  getAllUsers: (params) => api.get('/users/admin/all', { params }),
  getUnverifiedDoctors: (params) => api.get('/doctors/admin/unverified', { params }),
  verifyDoctor: (id) => api.patch(`/doctors/admin/${id}/verify`),
  getAllAppointments: (params) => api.get('/appointments/admin/all', { params })
};

export default api;
