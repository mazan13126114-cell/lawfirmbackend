// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('🚀 LawConnect Backend is running...');
});

// Connect Database
connectDB();

// Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
