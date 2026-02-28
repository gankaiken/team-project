import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize a connection pool (SQLite uses a single file connection)
const dbPromise = open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
});

// Create the table if it doesn't exist
dbPromise.then(async (db) => {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS arbitrary_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("SQLite database initialized successfully.");
}).catch(err => {
    console.error("Failed to initialize SQLite database:", err);
});

export default dbPromise;
