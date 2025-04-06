const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create a new database connection
const db = new sqlite3.Database(path.join(__dirname, 'piqniq.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

// Create tables
function createTables() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Emergency contacts table (many-to-many relationship)
    db.run(`CREATE TABLE IF NOT EXISTS emergency_contacts (
      user_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, contact_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Panic attacks table
    db.run(`CREATE TABLE IF NOT EXISTS panic_attacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      cause TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Add cause column to panic_attacks table if it doesn't exist
    db.all("PRAGMA table_info(panic_attacks)", (err, rows) => {
      if (err) {
        console.error('Error checking table schema:', err);
        return;
      }
      
      // Check if cause column exists
      const hasCauseColumn = Array.isArray(rows) && rows.some(row => row.name === 'cause');
      
      if (!hasCauseColumn) {
        db.run(`ALTER TABLE panic_attacks ADD COLUMN cause TEXT`, (err) => {
          if (err) {
            console.error('Error adding cause column:', err);
          } else {
            console.log('Successfully added cause column to panic_attacks table');
          }
        });
      }
    });

    // Verify the schema after creation
    verifySchema();
  });
}

// Add this function to verify the schema
function verifySchema() {
  db.all("PRAGMA table_info(panic_attacks)", (err, rows) => {
    if (err) {
      console.error('Error checking schema:', err);
      return;
    }
    console.log('Panic attacks table schema:', rows);
  });
}

module.exports = db; 