import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import imageRoutes from './routes/images.js';
import carsRoutes from './routes/cars.js';

dotenv.config();

const express = require('express');
const multer = require('multer');
const app = express();
const upload = multer();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/cars', carsRoutes);

app.post('/api/customer', upload.none(), async (req, res) => {
  console.log('booking_code:', req.body.booking_code);
});

app.listen(port,  () => {
  console.log(`Server running on port ${port}`);
});

// app.listen(port, '0.0.0.0',  () => {
//   console.log(`Server running on port ${port}`);
// });

