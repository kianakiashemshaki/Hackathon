import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReportPage.css';

const API_URL = 'http://localhost:3001';

interface PanicAttack {
  id: number;
  timestamp: string;
  cause: string | null;
}

const ReportPage: React.FC = () => {
  const [attacks, setAttacks] = useState<PanicAttack[]>([]);
  const [editedAttacks, setEditedAttacks] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
        // Initialize editedAttacks with current causes
        const initialEdits = data.reduce((acc: { [key: number]: string }, attack: PanicAttack) => {
          acc[attack.id] = attack.cause || '';
          return acc;
        }, {});
        setEditedAttacks(initialEdits);
      } else {
        setError('Failed to fetch panic attack history');
      }
    } catch (err) {
      setError('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (id: number, value: string) => {
    setEditedAttacks(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSave = async (id: number) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const url = `${API_URL}/api/panic-attacks/${id}`;
      console.log('Making request to:', url);
      console.log('Request payload:', { cause: editedAttacks[id] });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ cause: editedAttacks[id] })
      });

      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        setAttacks(prevAttacks => 
          prevAttacks.map(attack => 
            attack.id === id ? { ...attack, cause: editedAttacks[id] } : attack
          )
        );
        setError('');
      } else {
        setError(data.error || 'Failed to update cause');
      }
    } catch (err) {
      console.error('Full error details:', err);
      // Type check the error object
      if (err instanceof Error) {
        setError(`Network error: ${err.message}`);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const hasChanges = (attack: PanicAttack) => {
    return editedAttacks[attack.id] !== (attack.cause || '');
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
      {error && (
        <div className="error" onClick={() => setError('')}>
          {error}
          <div className="error-dismiss">Click to dismiss</div>
        </div>
      )}

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Cause</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {attacks.map(attack => (
            <tr key={attack.id}>
              <td>{formatDate(attack.timestamp)}</td>
              <td>
                <input
                  type="text"
                  value={editedAttacks[attack.id] || ''}
                  onChange={(e) => handleInputChange(attack.id, e.target.value)}
                  placeholder="Enter cause..."
                  className="cause-input"
                />
              </td>
              <td>
                <button
                  className={`save-button ${hasChanges(attack) ? 'has-changes' : ''}`}
                  onClick={() => handleSave(attack.id)}
                  disabled={!hasChanges(attack) || saving}
                >
                  {saving ? (
                    <span className="material-icons spinning">sync</span>
                  ) : (
                    <span className="material-icons">save</span>
                  )}
                </button>
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

// Update the CSS to make the error more user-friendly
const errorStyles = `
.error {
  color: #ff4444;
  text-align: center;
  padding: 15px 20px;
  margin: 10px 0;
  background-color: #ffe5e5;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.error:hover {
  opacity: 0.8;
}

.error-dismiss {
  font-size: 12px;
  margin-top: 5px;
  color: #666;
}
`;

// Add the styles to the existing CSS file
const styleSheet = document.createElement("style");
styleSheet.innerText = errorStyles;
document.head.appendChild(styleSheet);

export default ReportPage; 