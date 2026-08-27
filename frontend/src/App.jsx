import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { warmupServers } from './services/api';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Doctors from './pages/Doctors';
import DoctorDetail from './pages/DoctorDetail';
import BookAppointment from './pages/BookAppointment';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AppointmentHistory from './pages/AppointmentHistory';
import ConsultationRoom from './pages/ConsultationRoom';
import './App.css';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

function App() {
  useEffect(() => {
    // Silently pre-warm all Render microservices in the background on website visit
    warmupServers();
  }, []);

  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/doctors/:id" element={<DoctorDetail />} />
          <Route path="/book-appointment/:doctorId" element={
            <ProtectedRoute roles={['patient']}><BookAppointment /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>
          } />
          <Route path="/doctor-dashboard" element={
            <ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>
          } />
          <Route path="/admin-dashboard" element={
            <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/appointments" element={
            <ProtectedRoute><AppointmentHistory /></ProtectedRoute>
          } />
          <Route path="/consultation/:appointmentId" element={
            <ProtectedRoute roles={['doctor', 'patient']}><ConsultationRoom /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background: '#1a1a2e', color: '#eee', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }
      }} />
    </div>
  );
}

export default App;
