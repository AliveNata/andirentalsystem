import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

// Get all content sections
router.get('/', async (req, res) => {
  try {
    const [sections] = await pool.query('SELECT * FROM content_sections');
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update content section
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    
    await pool.query(
      'UPDATE content_sections SET title = ?, content = ? WHERE id = ?',
      [title, content, id]
    );
    
    res.json({ message: 'Content updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;