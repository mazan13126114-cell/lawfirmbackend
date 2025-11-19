// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 5000;
// starting the server which keeps listening on the specified PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// cors is used to allow cross-origin requests means
// requests coming from different domains (like frontend app)
// to access this backend API
// Helmet helps secure Express apps by setting various HTTP headers
// Body parser middleware to handle JSON and URL-encoded data
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '⚖️ Welcome to LawConnect API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      cases: '/api/cases',
      messages: '/api/messages',
      ai: '/api/ai',
      admin: '/api/admin'
    }
  });
});



// Import routes
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { Server } = require('socket.io');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/admin', adminRoutes);

// Error handlers 
app.use(notFound);
app.use(errorHandler);





module.exports = { app };