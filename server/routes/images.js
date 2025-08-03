import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyToken } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Get all images
router.get('/', async (req, res) => {
  try {
    const [images] = await pool.query('SELECT * FROM images');
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload new image
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { section, description } = req.body;
    const imagePath = `/uploads/${req.file.filename}`;
    
    await pool.query(
      'INSERT INTO images (section, path, description) VALUES (?, ?, ?)',
      [section, imagePath, description]
    );
    
    res.json({ message: 'Image uploaded successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete image
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM images WHERE id = ?', [id]);
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;