const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret (in production, use environment variable)
const JWT_SECRET = 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email } = req.body;

  try {
    // Check if email already exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (row) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Insert new user
      db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const userId = this.lastID;
        const token = jwt.sign({ userId, name }, JWT_SECRET);
        res.json({ token, userId });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const { name } = req.body;

  try {
    db.get('SELECT * FROM users WHERE name = ?', [name], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: row.id, name: row.name }, JWT_SECRET);
      res.json({ token, userId: row.id });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Emergency contacts routes
app.post('/api/contacts', authenticateToken, async (req, res) => {
  const { contactName } = req.body;
  const userId = req.user.userId;

  try {
    // First, find the contact by name
    db.get('SELECT id FROM users WHERE name = ?', [contactName], (err, contact) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!contact) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent users from adding themselves as contacts
      if (contact.id === userId) {
        return res.status(400).json({ error: 'Cannot add yourself as an emergency contact' });
      }

      // Check if the contact is already added
      db.get(
        'SELECT * FROM emergency_contacts WHERE user_id = ? AND contact_id = ?',
        [userId, contact.id],
        (err, existingContact) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          if (existingContact) {
            return res.status(400).json({ error: 'Contact already added' });
          }

          // Add the contact
          db.run(
            'INSERT INTO emergency_contacts (user_id, contact_id) VALUES (?, ?)',
            [userId, contact.id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              res.json({ message: 'Contact added successfully' });
            }
          );
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/contacts', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    db.all(`
      SELECT u.id, u.name, u.email 
      FROM users u
      JOIN emergency_contacts ec ON u.id = ec.contact_id
      WHERE ec.user_id = ?
      ORDER BY ec.created_at DESC
    `, [userId], (err, contacts) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(contacts);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle authentication
  socket.on('authenticate', (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      socket.user = user;
      console.log(`User ${user.name} authenticated via WebSocket`);
    } catch (err) {
      console.error('WebSocket authentication failed:', err);
      socket.disconnect();
    }
  });

  // Handle panic button click
  socket.on('button_click', (data) => {
    if (!socket.user) {
      console.error('Unauthorized panic button click');
      return;
    }

    const userId = socket.user.userId;
    const userName = socket.user.name;
    const location = data.location || 'Location unavailable';
    const coordinates = data.coordinates || null;

    // Record the panic attack
    db.run('INSERT INTO panic_attacks (user_id) VALUES (?)', [userId], (err) => {
      if (err) {
        console.error('Error recording panic attack:', err);
        return;
      }

      // Get user's emergency contacts
      db.all(`
        SELECT u.id, u.name, u.email 
        FROM users u
        JOIN emergency_contacts ec ON u.id = ec.contact_id
        WHERE ec.user_id = ?
      `, [userId], (err, contacts) => {
        if (err) {
          console.error('Error fetching contacts:', err);
          return;
        }

        // Send notification to each contact
        contacts.forEach(contact => {
          // Find the socket for this contact
          const contactSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.user && s.user.userId === contact.id);

          if (contactSocket) {
            contactSocket.emit('notification', {
              type: 'panic_attack',
              message: `${userName} is under attack!\nGo to the rescue at ${location}`,
              timestamp: new Date().toISOString(),
              userId: userId,
              location: location,
              coordinates: coordinates
            });
          }
        });
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 