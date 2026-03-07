import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = !!process.env.DATABASE_URL;

class DatabaseWrapper {
    constructor() {
        this.client = null;
        this.type = isProd ? 'postgres' : 'sqlite';
    }

    async init() {
        if (this.type === 'postgres') {
            const { Pool } = pg;
            this.client = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await this.client.query(`
                CREATE TABLE IF NOT EXISTS arbitrary_data (
                    id SERIAL PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("PostgreSQL database initialized successfully.");
        } else {
            this.client = await open({
                filename: path.join(__dirname, 'database.sqlite'),
                driver: sqlite3.Database
            });
            await this.client.exec(`
                CREATE TABLE IF NOT EXISTS arbitrary_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("SQLite database initialized successfully.");
        }
    }

    async insert(jsonData) {
        if (this.type === 'postgres') {
            const res = await this.client.query('INSERT INTO arbitrary_data (data) VALUES ($1) RETURNING *', [jsonData]);
            return res.rows[0];
        } else {
            const res = await this.client.run('INSERT INTO arbitrary_data (data) VALUES (?)', [jsonData]);
            return await this.client.get('SELECT * FROM arbitrary_data WHERE id = ?', [res.lastID]);
        }
    }

    async getAll() {
        if (this.type === 'postgres') {
            const res = await this.client.query('SELECT * FROM arbitrary_data ORDER BY created_at DESC');
            return res.rows;
        } else {
            return await this.client.all('SELECT * FROM arbitrary_data ORDER BY created_at DESC');
        }
    }

    async getById(id) {
        if (this.type === 'postgres') {
            const res = await this.client.query('SELECT * FROM arbitrary_data WHERE id = $1', [id]);
            return res.rows[0];
        } else {
            return await this.client.get('SELECT * FROM arbitrary_data WHERE id = ?', [id]);
        }
    }

    async update(id, jsonData) {
        if (this.type === 'postgres') {
            const res = await this.client.query('UPDATE arbitrary_data SET data = $1 WHERE id = $2 RETURNING *', [jsonData, id]);
            return res.rowCount > 0 ? res.rows[0] : null;
        } else {
            const res = await this.client.run('UPDATE arbitrary_data SET data = ? WHERE id = ?', [jsonData, id]);
            if (res.changes === 0) return null;
            return await this.client.get('SELECT * FROM arbitrary_data WHERE id = ?', [id]);
        }
    }

    async deleteData(id) {
        if (this.type === 'postgres') {
            const res = await this.client.query('DELETE FROM arbitrary_data WHERE id = $1', [id]);
            return res.rowCount;
        } else {
            const res = await this.client.run('DELETE FROM arbitrary_data WHERE id = ?', [id]);
            return res.changes;
        }
    }
}

const db = new DatabaseWrapper();
const dbPromise = db.init().then(() => db);
export default dbPromise;
