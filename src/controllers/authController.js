/* =========================================================================
   Handles user authentication, registration, profile
   management, password management, and logout functionality using Prisma
   ================================================================= */

const { PrismaClient } = require('@prisma/client'); // Import Prisma Client
const prisma = new PrismaClient(); // Instantiate Prisma to interact with DB
const { generateToken } = require("../utils/jwt"); // Utility to generate JWT tokens
const bcrypt = require('bcryptjs'); // Library for hashing passwords securely
const crypto = require('crypto'); // Node's built-in crypto module to generate secure tokens

/* =========================================================================
    Register new user
   ================================================================= */
const register = async (req, res, next) => {
  try {
    if (!req || !req.body) {
      return res.status(400).json({ success: false, message: 'Invalid request body' });
    }

    const { name, email, password, role, phone, address, specialization, licenseNumber, experience } = req.body;

    // Basic sanity checks (validation middleware should normally handle this)
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash password before storing
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'client', // default role is 'client'
        phone,
        address,
        ...(role === 'lawyer' && { specialization, licenseNumber, experience }) // add extra fields if lawyer
      },
      select: { id: true, name: true, email: true, role: true, isVerified: true } // return only needed fields
    });

    if (!user) {
      return res.status(500).json({ success: false, message: 'Failed to create user' });
    }

    // Generate JWT token for the user (default role to 'client' if missing)
    const token = generateToken(user.id, user.role || 'client');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token }
    });
  } catch (error) {
    next(error); // forward error to global error handler
  }
};

/* =========================================================================
   Login user
   ================================================================= */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Update last login timestamp
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, message: 'Login successful', data: { user: userWithoutPassword, token } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
    Get current logged-in user
   ================================================================= */
const getMe = async (req, res, next) => {
  try {
    // Fetch user data from DB by user ID from JWT
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, address: true, specialization: true,
        licenseNumber: true, experience: true,
        profilePicture: true, isActive: true, isVerified: true,
        lastLogin: true, createdAt: true
      }
    });

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Update user profile
   ================================================================= */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, specialization, experience } = req.body;

    // Build object for fields to update
    const updateData = { name, phone, address };
    if (req.user.role === 'lawyer') { // Only lawyers can update these
      updateData.specialization = specialization;
      updateData.experience = experience;
    }

    // Update user in DB
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, address: true, specialization: true, experience: true
      }
    });

    res.json({ success: true, message: 'Profile updated successfully', data: { user } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Change password
   ================================================================= */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Fetch user from DB
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};


/* =========================================================================
   Logout user
   ================================================================= */
const logout = async (req, res, next) => {
  try {
    // Since JWT is stateless, logout is handled on client side by deleting token
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Simple password reset (without email verification)
   ================================================================= */
const resetPasswordSimple = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

// Export all controller functions
module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  
  resetPasswordSimple,
  logout
};
