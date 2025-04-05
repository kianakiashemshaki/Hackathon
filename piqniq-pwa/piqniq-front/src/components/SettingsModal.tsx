import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

interface Contact {
  id: number;
  name: string;
  email: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [contactName, setContactName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contactName }),
      });

      if (response.ok) {
        setSuccess('Contact added successfully');
        setContactName('');
        fetchContacts(); // Refresh the contacts list
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add contact');
      }
    } catch (err) {
      setError('An error occurred while adding the contact');
    }
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
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <button type="submit" className="add-button">Add Contact</button>
        </form>

        <div className="contacts-list">
          <h3>Your Emergency Contacts</h3>
          {isLoading ? (
            <div className="loading">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="no-contacts">No emergency contacts added yet</div>
          ) : (
            <ul>
              {contacts.map(contact => (
                <li key={contact.id} className="contact-item">
                  <span className="contact-name">{contact.name}</span>
                  <span className="contact-email">{contact.email}</span>
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