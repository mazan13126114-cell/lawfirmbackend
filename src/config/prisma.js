// src/config/prisma.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to database successfully!');
  } catch (error) {
    console.error('❌ Prisma connection error:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await prisma.$disconnect();
  console.log('✅ Prisma disconnected');
};

module.exports = { prisma, connectDB, disconnectDB };