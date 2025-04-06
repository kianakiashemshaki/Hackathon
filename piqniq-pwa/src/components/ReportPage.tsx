import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReportPage.css';

const API_URL = `http://${window.location.hostname}:3001`;

interface PanicAttack {
  id: number;
  timestamp: string;
  cause: string | null;
}

const ReportPage: React.FC = () => {
  const [attacks, setAttacks] = useState<PanicAttack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttacks();
  }, []);

  const fetchAttacks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/panic-attacks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAttacks(data);
      } else {
        setError('Failed to fetch panic attack history');
      }
    } catch (err) {
      setError('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleCauseUpdate = async (id: number, cause: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/panic-attacks/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cause })
      });

      if (response.ok) {
        fetchAttacks(); // Refresh the data
      } else {
        setError('Failed to update cause');
      }
    } catch (err) {
      setError('Error updating cause');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <h1>Panic Attack History</h1>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Cause</th>
          </tr>
        </thead>
        <tbody>
          {attacks.map(attack => (
            <tr key={attack.id}>
              <td>{formatDate(attack.timestamp)}</td>
              <td>
                <input
                  type="text"
                  value={attack.cause || ''}
                  onChange={(e) => handleCauseUpdate(attack.id, e.target.value)}
                  placeholder="Enter cause..."
                  className="cause-input"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {attacks.length === 0 && !loading && (
        <div className="no-data">No panic attacks recorded</div>
      )}
    </div>
  );
};

export default ReportPage; 