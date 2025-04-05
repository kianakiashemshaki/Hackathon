import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

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
  email: 'letmemakenewone@gmail.com',
  phone: '+1 (619) 609 3341'
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [contactName, setContactName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <h2>Emergency Contacts</h2>
        
        <div className="emergency-contact-info">
          <h3>Emergency Contact</h3>
          <p>Email: {EMERGENCY_CONTACT.email}</p>
          <p>Phone: {EMERGENCY_CONTACT.phone}</p>
        </div>

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
            />
          </div>
          <button type="submit" className="add-button" disabled={isLoading}>
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
                  <span className="contact-name">{contact.name}</span>
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