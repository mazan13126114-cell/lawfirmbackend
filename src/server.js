const express = require('express');
const sequelize = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Hello LawConnect Backend!');
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Test database connection
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully!');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
});
