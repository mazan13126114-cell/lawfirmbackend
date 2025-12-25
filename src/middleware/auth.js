// src/middleware/auth.js
const { verifyToken } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =======================
// Protect routes middleware
// =======================

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for Bearer token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Reject if no token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided'
      });
    }

    // Verify token using JWT utility
    const decoded = verifyToken(token);

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true
      }
    });

    // Reject if user not found in DB
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reject if account is deactivated
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Attach user info to request object for downstream controllers
    req.user = user;
    next();
  } catch (error) {
    // Catch token errors (invalid, expired, etc.)
    return res.status(401).json({
      success: false,
      message: error.message || 'Not authorized, token failed'
    });
  }
};

// ✅ THIS MUST BE UNCOMMENTED - Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user exists on request (protect middleware should run first)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if user role is allowed
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }

    // Authorized, continue
    next();
  };
};

module.exports = {
  protect,
  authorize // ✅ MUST be exported
};