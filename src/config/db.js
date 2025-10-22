// src/config/db.js

// 1. Load dotenv so we can read .env variables
require('dotenv').config();

// 2. Load Sequelize
const { Sequelize } = require('sequelize');

// 3. Create a Sequelize instance (our connection)
const sequelize = new Sequelize(
  process.env.DB_NAME,      // database name
  process.env.DB_USER,      // username
  process.env.DB_PASSWORD,  // password
  {
    host: process.env.DB_HOST,  // host
    dialect: 'mysql',           // type of database
    logging: false              // turn off SQL logs
  }
);

// 4. Test the connection
sequelize.authenticate()
  .then(() => console.log('✅ Database connected!'))
  .catch(err => console.error('❌ Unable to connect to database:', err));

// 5. Export the connection so other files can use it
module.exports = sequelize;
