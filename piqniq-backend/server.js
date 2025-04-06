const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes with minimal restrictions
app.use(cors({
  origin: 'http://localhost:3000', // Your frontend URL
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Configure Socket.IO with minimal CORS restrictions
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["*"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  path: '/socket.io/',
  serveClient: false,
  cookie: false
});

// Middleware
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
      console.error('Token verification error:', err);
      return res.sendStatus(403);
    }
    
    console.log('Authenticated user:', user); // Debug log
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

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    console.log('Attempting to sign in user:', name);
    
    // Find user by name
    db.get('SELECT * FROM users WHERE name = ?', [name], (err, user) => {
      if (err) {
        console.error('Database error during sign in:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        console.log('User not found:', name);
        return res.status(401).json({ error: 'User not found' });
      }

      console.log('User found, generating token for:', name);
      const token = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET);
      res.json({ token, userId: user.id });
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'Server error during sign in' });
  }
});

// Add emergency contact
app.post('/api/contacts', authenticateToken, async (req, res) => {
  const { name, email = '' } = req.body;
  const userId = req.user.userId;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    console.log('Attempting to add contact:', { name, email, userId });
    
    // Check if contact already exists for this user
    const existingContact = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM emergency_contacts WHERE user_id = ? AND contact_id IN (SELECT id FROM users WHERE name = ?)',
        [userId, name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingContact) {
      return res.status(400).json({ error: 'A contact with this name already exists' });
    }

    // Get contact ID from users table
    const contact = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Add emergency contact relationship
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO emergency_contacts (user_id, contact_id, created_at) VALUES (?, ?, datetime("now"))',
        [userId, contact.id],
        (err) => {
          if (err) {
            console.error('Database error adding contact:', err);
            reject(err);
          } else resolve(null);
        }
      );
    });

    console.log('Contact added successfully');
    res.status(201).json({ message: 'Contact added successfully' });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: 'Error adding contact. Please try again.' });
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

const EMERGENCY_CONTACT = {
  email: 'letmemakenewone@gmail.com',
  phone: '+1 (619) 609 3341'
};

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

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', reason);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
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
    db.run(
      'INSERT INTO panic_attacks (user_id, cause) VALUES (?, ?)',
      [userId, null],
      (err) => {
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
              const notificationData = {
                type: 'panic_attack',
                message: `${userName} is under attack!\nGo to the rescue at ${location}`,
                timestamp: new Date().toISOString(),
                userId: userId,
                location: location,
                coordinates: coordinates,
                emergencyContact: EMERGENCY_CONTACT
              };
              console.log('Sending notification:', notificationData);
              contactSocket.emit('notification', notificationData);
            }
          });
        });
      }
    );
  });
});

// When recording a panic attack, include the cause field
app.post('/api/panic-attacks', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { cause } = req.body;

  db.run(
    'INSERT INTO panic_attacks (user_id, cause) VALUES (?, ?)',
    [userId, cause || null],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Get panic attacks for a user
app.get('/api/panic-attacks', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    'SELECT id, timestamp, cause FROM panic_attacks WHERE user_id = ? ORDER BY timestamp DESC',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Update panic attack cause
app.patch('/api/panic-attacks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { cause } = req.body;
  const userId = req.user.userId;

  console.log('Received PATCH request:', {
    id,
    cause,
    userId,
    headers: req.headers,
    body: req.body
  });

  db.run(
    'UPDATE panic_attacks SET cause = ? WHERE id = ? AND user_id = ?',
    [cause, id, userId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        console.log('No rows updated');
        return res.status(404).json({ error: 'Panic attack not found or unauthorized' });
      }

      console.log('Successfully updated panic attack');
      res.json({ message: 'Cause updated successfully' });
    }
  );
});

// Debug route to check table structure (you can remove this later)
app.get('/api/debug/panic-attacks-schema', authenticateToken, (req, res) => {
  db.all("PRAGMA table_info(panic_attacks)", (err, rows) => {
    if (err) {
      console.error('Error checking schema:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
}); 