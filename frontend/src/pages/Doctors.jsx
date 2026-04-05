import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doctorAPI } from '../services/api';
import { FiSearch, FiMapPin, FiStar, FiFilter } from 'react-icons/fi';
import { RiStethoscopeLine } from 'react-icons/ri';
import './Doctors.css';

const Doctors = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  
  if (user?.role === 'doctor') {
    return <Navigate to="/doctor-dashboard" />;
  }
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [specializations, setSpecializations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDoctors();
  }, [page, specialization]);

  useEffect(() => {
    fetchSpecializations();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 9 };
      if (specialization) params.specialization = specialization;
      const { data } = await doctorAPI.getAll(params);
      setDoctors(data.doctors || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecializations = async () => {
    try {
      const { data } = await doctorAPI.getSpecializations();
      setSpecializations(data.specializations || []);
    } catch (error) {
      console.error('Error fetching specializations:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return fetchDoctors();
    setLoading(true);
    try {
      const { data } = await doctorAPI.search({ q: searchQuery, specialization });
      setDoctors(data.doctors || []);
      setTotalPages(1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctors-page">
      <div className="container">
        <div className="doctors-header animate-fade-in">
          <h1 className="section-title">Find Your Doctor</h1>
          <p className="section-subtitle">Browse and connect with top-rated specialists</p>
        </div>

        {/* Search & Filter */}
        <div className="search-section glass animate-fade-in">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-wrapper">
              <FiFilter className="filter-icon" />
              <select
                className="filter-select"
                value={specialization}
                onChange={(e) => { setSpecialization(e.target.value); setPage(1); }}
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>

        {/* Doctor Cards */}
        {loading ? (
          <div className="page-loading"><div className="spinner"></div><p>Loading doctors...</p></div>
        ) : doctors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🩺</div>
            <h3>No doctors found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="doctors-grid">
              {doctors.map((doctor, i) => (
                <Link
                  to={`/doctors/${doctor._id}`}
                  key={doctor._id}
                  className="doctor-card card"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="doctor-card-header">
                    <div className="doctor-avatar">
                      {doctor.firstName?.charAt(0)}{doctor.lastName?.charAt(0)}
                    </div>
                    <div className="doctor-verified">
                      {doctor.isVerified && <span className="badge badge-success">Verified</span>}
                    </div>
                  </div>
                  <div className="doctor-card-body">
                    <h3>Dr. {doctor.firstName} {doctor.lastName}</h3>
                    <p className="doctor-specialization">
                      <RiStethoscopeLine /> {doctor.specialization}
                    </p>
                    <p className="doctor-hospital">
                      <FiMapPin /> {doctor.hospital?.name}, {doctor.hospital?.city}
                    </p>
                    <div className="doctor-meta">
                      <span className="doctor-rating">
                        <FiStar /> {doctor.rating?.average?.toFixed(1)} ({doctor.rating?.count})
                      </span>
                      <span className="doctor-experience">{doctor.experience}+ yrs</span>
                    </div>
                  </div>
                  <div className="doctor-card-footer">
                    <span className="doctor-fee">₹{doctor.consultationFee}</span>
                    <span className="view-profile">View Profile →</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                  Previous
                </button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Doctors;
