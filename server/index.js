import express from 'express';
import cors from 'cors';
import dbPromise from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Create (Store arbitrary data)
app.post('/api/data', async (req, res) => {
    try {
        const { body } = req;
        const db = await dbPromise;

        // In SQLite we must serialize JSON payloads to strings
        const jsonData = JSON.stringify(body);
        const result = await db.run('INSERT INTO arbitrary_data (data) VALUES (?)', [jsonData]);

        // Fetch the newly inserted record
        const newRecord = await db.get('SELECT * FROM arbitrary_data WHERE id = ?', [result.lastID]);

        if (newRecord && newRecord.data) {
            newRecord.data = JSON.parse(newRecord.data);
        }

        res.status(201).json(newRecord);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while saving data' });
    }
});

// Read All
app.get('/api/data', async (req, res) => {
    try {
        const db = await dbPromise;
        const allData = await db.all('SELECT * FROM arbitrary_data ORDER BY created_at DESC');

        // Parse the stored JSON strings back into objects structure
        const parsed = allData.map(row => ({
            ...row,
            data: JSON.parse(row.data)
        }));

        res.json(parsed);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while fetching data' });
    }
});

// Read One by ID
app.get('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await dbPromise;
        const data = await db.get('SELECT * FROM arbitrary_data WHERE id = ?', [id]);

        if (!data) {
            return res.status(404).json({ error: 'Data not found' });
        }

        data.data = JSON.parse(data.data);
        res.json(data);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while fetching specific data' });
    }
});

// Update
app.put('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req;
        const db = await dbPromise;

        const jsonData = JSON.stringify(body);
        const result = await db.run('UPDATE arbitrary_data SET data = ? WHERE id = ?', [jsonData, id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }

        const updateData = await db.get('SELECT * FROM arbitrary_data WHERE id = ?', [id]);
        if (updateData && updateData.data) {
            updateData.data = JSON.parse(updateData.data);
        }

        res.json(updateData);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while updating data' });
    }
});

// Delete
app.delete('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await dbPromise;
        const result = await db.run('DELETE FROM arbitrary_data WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }

        res.json({ message: 'Data deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while deleting data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
