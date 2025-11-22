/* ====================================================================================================
    OVERVIEW: 
      It wires everything together like an electrical main panel.
    TECHNOLOGIES INVOLVED:
      - Express  → Web server framework
      - Prisma   → Database  (MySQL)
      - Helmet   → Security layer (prevents attacks)
      - CORS     → Allow frontend (Vue) to communicate with backend
      - dotenv   → Load environment variables

   ==================================================================================================== */


//  Load environment variables from .env file like DATABASE_URL, PORT, CLIENT_URL
require('dotenv').config();

//  Import core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

//  Database utilities from Prisma config
const { connectDB, disconnectDB, prisma } = require('./config/prisma');

//  Initialize Express Application
const app = express();
const PORT = process.env.PORT || 5000;



/* ============================================================================================
   MIDDLEWARE SETUP
   Middleware acts like "security gates" and "parsers" before requests reach your routes.
   ============================================================================================ */

//  Helmet → Adds security headers to protect against common attacks 
app.use(helmet());

//  CORS → Allows frontend (Vue) to talk to backend from another domain or port
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

//  Enables JSON parsing for incoming requests
app.use(express.json());

//  Allows parsing of form-encoded data (extended: true → allows nested objects (like user[address][city]))
app.use(express.urlencoded({ extended: true }));



//  Optional debug logging (only runs in development mode)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(` ${req.method} → ${req.path}`);
    next();
  });
}



/* =====================================================================
    BASE ROUTE
   Quick test route to confirm server is alive and returning structured info.
   ===================================================================== */

app.get('/', (req, res) => {
  res.json({
    message: 'Yes, you are welcome here ofcourse!',
    version: '1.0.0',
    status: 'dont worry be happy',
    endpoints: {
      health: '/health',
      dbStatus: '/api/db-status',
      models: '/api/models',
      auth: '/api/auth',
      cases: '/api/cases',
      messages: '/api/messages',
      ai: '/api/ai',
      admin: '/api/admin'
    }
  });
});



/* =====================================================================
    HEALTH CHECK ROUTE
   Purpose: Used for monitoring by frontend or cloud deployment services.
   ===================================================================== */

app.get('/health', async (req, res) => {
  try {
    await prisma.$connect();

    res.json({
      status: 'OK',
      message: 'Server is running',
      database: 'Connected ',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Server running but DB disconnected ',
      error: error.message
    });
  }
});



/* ==============================================================================================
    ROUTES IMPORT
   Each route file contains logic related to a specific feature of the platform.
   ============================================================================================== */

const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes');


//  Custom error handlers
const { notFound, errorHandler } = require('./middleware/errorHandler');



//  Static file serving (uploaded documents accessible publicly)

app.use('/uploads', express.static('uploads'));



//  Bind routes to the API paths
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);



//  Catch-all error handlers (must always run last)
app.use(notFound);
app.use(errorHandler);



/* ================================================================================================
     START SERVER
   Steps:
     1. Connect to Database
     2. Start Express server
   ================================================================================================= */

async function startServer() {
  try {
    console.log(`\n Starting LawConnect Backend...\n`);

    await connectDB();
    console.log(` Prisma connected successfully.`);

    app.listen(PORT, () => {
      console.log(`\n You are running on  http://localhost:${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error(' Failed to launch server:', error.message);
    process.exit(1);
  }
}



/* =================================================================================================
    GRACEFUL SHUTDOWN
   When user presses Ctrl+C, we close DB connection properly to avoid corruption.
   ================================================================================================= */

process.on('SIGINT', async () => {
  console.log('\n yes, go away safely as we have disconnected database for you but we will miss you ');
  await disconnectDB();
  process.exit(0);
});



//  Start everything
startServer();

module.exports = app;
