import { useState, useMemo } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './AvailabilityCalendar.css';

const AvailabilityCalendar = ({ selectedDate, availableDates = [], onDateSelect, timezone = 'Asia/Kolkata' }) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate || new Date()));

  // Helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    now.setHours(0, 0, 0, 0);

    const days = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
      days.push({ type: 'empty' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const isPast = date < now;
      const isAvailable = availableDates.includes(dateStr);
      const isSelected = selectedDate === dateStr;

      days.push({
        day: d,
        dateStr,
        isPast,
        isAvailable,
        isSelected,
        type: 'day'
      });
    }
    return days;
  }, [viewDate, availableDates, selectedDate, timezone]);

  const changeMonth = (offset) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="availability-calendar glass shadow-lg">
      <div className="calendar-header">
        <button onClick={() => changeMonth(-1)} className="nav-btn"><FiChevronLeft /></button>
        <h3>{monthName}</h3>
        <button onClick={() => changeMonth(+1)} className="nav-btn"><FiChevronRight /></button>
      </div>
      
      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="calendar-grid">
        {calendarData.map((d, i) => (
          <div 
            key={i} 
            className={`calendar-cell ${d.type} ${d.isPast ? 'past' : ''} ${d.isSelected ? 'selected' : ''} ${d.isAvailable ? 'available' : ''}`}
            onClick={() => d.type === 'day' && !d.isPast && onDateSelect(d.dateStr)}
          >
            {d.day}
            {d.isAvailable && !d.isPast && <div className="availability-indicator pulse"></div>}
          </div>
        ))}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <span className="dot dot-available"></span> Available
        </div>
        <div className="legend-item">
          <span className="dot dot-selected"></span> Selected
        </div>
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
