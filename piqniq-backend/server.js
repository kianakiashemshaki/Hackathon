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
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["*"],
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
  const { name, email } = req.body;
  const userId = req.user.userId;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    console.log('Attempting to add contact:', { name, email, userId });
    
    // Check if contact already exists
    const existingContact = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM emergency_contacts WHERE user_id = ? AND email = ?',
        [userId, email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingContact) {
      return res.status(400).json({ error: 'Contact already exists' });
    }

    // Add new contact
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO emergency_contacts (user_id, name, email) VALUES (?, ?, ?)',
        [userId, name, email],
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
    });
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
}); 