// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./config/db');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
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

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    
    res.json({
      status: 'OK',
      message: 'Server is running',
      database: 'Connected ✅',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Server is running but database is disconnected',
      database: 'Disconnected ❌',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database status endpoint (detailed)
app.get('/api/db-status', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    
    const dbName = db.sequelize.config.database;
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    
    const [results] = await db.sequelize.query('SELECT 1 + 1 AS result');
    
    res.json({
      status: 'connected',
      database: dbName,
      host: db.sequelize.config.host,
      dialect: db.sequelize.config.dialect,
      tablesCount: tables.length,
      tables: tables,
      testQuery: `✅ Passed (Result: ${results[0].result})`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    });
  }
});

// Models info endpoint
app.get('/api/models', (req, res) => {
  const models = Object.keys(db).filter(key => key !== 'sequelize');
  
  const modelsInfo = models.map(modelName => {
    const model = db[modelName];
    const attributes = model.rawAttributes;
    const attributeNames = Object.keys(attributes).map(attr => ({
      name: attr,
      type: attributes[attr].type.key,
      allowNull: attributes[attr].allowNull !== false
    }));
    
    return {
      name: modelName,
      tableName: model.tableName,
      attributesCount: attributeNames.length,
      attributes: attributeNames
    };
  });
  
  res.json({
    totalModels: models.length,
    models: modelsInfo
  });
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
// app.use('/api/messages', chatRoutes); // Will add next
// app.use('/api/admin', adminRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Not Found - ${req.originalUrl}`
  });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    success: false,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server with database connection
async function startServer() {
  try {
    console.log('\n🚀 Starting LawConnect Backend Server...\n');
    
    // Connect to database first
    await connectDB();
    
    console.log('\n📦 Loaded Models:');
    const models = Object.keys(db).filter(key => key !== 'sequelize');
    models.forEach(model => console.log(`   ✅ ${model}`));
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n✅ Server is running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n🔗 Available endpoints:`);
      console.log(`   - http://localhost:${PORT}/`);
      console.log(`   - http://localhost:${PORT}/health`);
      console.log(`   - http://localhost:${PORT}/api/db-status`);
      console.log(`   - http://localhost:${PORT}/api/models`);
      console.log(`\n💡 Press Ctrl+C to stop the server\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  try {
    await db.sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app;