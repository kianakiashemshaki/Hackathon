import React, { useState, useEffect } from 'react';
import './SettingsModal.css';
import { useNavigate } from 'react-router-dom';

const API_URL = `http://${window.location.hostname}:3001`;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Contact {
  id: number;
  name: string;
  email: string;
}

const EMERGENCY_CONTACT = {
  email: '911',
  phone: '911'
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [contactName, setContactName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Error fetching contacts. Please try again.');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: contactName, email: '' })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Contact added successfully');
        setContactName('');
        fetchContacts();
      } else {
        setError(data.error || 'Failed to add contact');
      }
    } catch (err) {
      console.error('Error adding contact:', err);
      setError('Error adding contact. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h2>Emergency Contacts</h2>
        
        <form onSubmit={handleAddContact}>
          <div className="form-group">
            <label htmlFor="contactName">Add New Contact</label>
            <input
              type="text"
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact's name"
              required
              disabled={isLoading}
              style={{width: '100%'}}
            />
          </div>
          <button 
            type="submit" 
            className="add-button" 
            disabled={isLoading}
            style={{width: '100%'}}
          >
            {isLoading ? 'Adding...' : 'Add Contact'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="contacts-list">
          <h3>Your Emergency Contacts</h3>
          {contacts.length === 0 ? (
            <p>No emergency contacts added yet</p>
          ) : (
            <ul>
              {contacts.map(contact => (
                <li key={contact.id} className="contact-item">
                  <span className="contact-name" style={{color: 'green', display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                    <span>{contact.name}</span>
                    <span>{contact.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 
