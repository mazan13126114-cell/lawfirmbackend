// src/controllers/adminController.js
const { User, Case, Message, Document, AiLogs, sequelize } = require('../models');
const { Op } = require('sequelize');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res, next) => {
  try {
    // Total counts
    const totalUsers = await User.count();
    const totalClients = await User.count({ where: { role: 'client' } });
    const totalLawyers = await User.count({ where: { role: 'lawyer' } });
    const totalCases = await Case.count();
    const totalMessages = await Message.count();
    const totalDocuments = await Document.count();
    const totalAiQueries = await AiLogs.count();

    // Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.count({
      where: {
        lastLogin: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // Case status breakdown
    const casesByStatus = await Case.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Cases by type
    const casesByType = await Case.findAll({
      attributes: [
        'caseType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['caseType']
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCases = await Case.count({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } }
    });
    const recentMessages = await Message.count({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } }
    });
    const recentUsers = await User.count({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } }
    });

    // Average case probability
    const avgProbability = await Case.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('probability_score')), 'avgScore']]
    });

    // Cases with lawyers vs without
    const assignedCases = await Case.count({ where: { lawyerId: { [Op.ne]: null } } });
    const unassignedCases = await Case.count({ where: { lawyerId: null } });

    // Top lawyers by case count
    const topLawyers = await Case.findAll({
      attributes: [
        'lawyerId',
        [sequelize.fn('COUNT', sequelize.col('Case.id')), 'caseCount']
      ],
      where: { lawyerId: { [Op.ne]: null } },
      group: ['lawyerId'],
      order: [[sequelize.literal('caseCount'), 'DESC']],
      limit: 5,
      include: [{
        model: User,
        as: 'lawyer',
        attributes: ['id', 'name', 'email', 'specialization']
      }]
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalClients,
          totalLawyers,
          totalCases,
          totalMessages,
          totalDocuments,
          totalAiQueries,
          activeUsers
        },
        cases: {
          total: totalCases,
          assigned: assignedCases,
          unassigned: unassignedCases,
          byStatus: casesByStatus,
          byType: casesByType,
          avgProbability: parseFloat(avgProbability?.dataValues?.avgScore || 0).toFixed(2)
        },
        recentActivity: {
          newCases: recentCases,
          newMessages: recentMessages,
          newUsers: recentUsers
        },
        topLawyers: topLawyers.map(l => ({
          lawyer: l.lawyer,
          caseCount: parseInt(l.dataValues.caseCount)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with filters
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user details
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
const getUserDetails = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [
        { 
          model: Case, 
          as: 'clientCases',
          limit: 5,
          order: [['createdAt', 'DESC']]
        },
        { 
          model: Case, 
          as: 'lawyerCases',
          limit: 5,
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional stats
    const messagesSent = await Message.count({ where: { senderId: userId } });
    const messagesReceived = await Message.count({ where: { receiverId: userId } });
    const documentsUploaded = await Document.count({ where: { uploadedBy: userId } });
    const aiQueriesCount = await AiLogs.count({ where: { userId } });

    res.json({
      success: true,
      data: {
        user,
        stats: {
          messagesSent,
          messagesReceived,
          documentsUploaded,
          aiQueriesCount,
          totalCases: user.role === 'client' ? user.clientCases.length : user.lawyerCases.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user (activate/deactivate, change role, etc.)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { isActive, role, isVerified } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (userId === req.user.id.toString() && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role) updateData.role = role;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    await user.update(updateData);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all cases with filters (admin view)
// @route   GET /api/admin/cases
// @access  Private (Admin only)
const getAllCasesAdmin = async (req, res, next) => {
  try {
    const { status, caseType, priority, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (caseType) where.caseType = caseType;
    if (priority) where.priority = priority;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { caseNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Case.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'lawyer', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.json({
      success: true,
      data: {
        cases: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign/reassign lawyer to case
// @route   PUT /api/admin/cases/:id/assign
// @access  Private (Admin only)
const assignLawyerToCase = async (req, res, next) => {
  try {
    const caseId = req.params.id;
    const { lawyerId } = req.body;

    const caseData = await Case.findByPk(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Verify lawyer exists
    const lawyer = await User.findOne({
      where: { id: lawyerId, role: 'lawyer' }
    });

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found'
      });
    }

    await caseData.update({
      lawyerId,
      status: 'assigned'
    });

    const updatedCase = await Case.findByPk(caseId, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'lawyer', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.json({
      success: true,
      message: 'Lawyer assigned successfully',
      data: { case: updatedCase }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete case
// @route   DELETE /api/admin/cases/:id
// @access  Private (Admin only)
const deleteCaseAdmin = async (req, res, next) => {
  try {
    const caseId = req.params.id;

    const caseData = await Case.findByPk(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    await caseData.destroy();

    res.json({
      success: true,
      message: 'Case deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI usage statistics
// @route   GET /api/admin/ai-stats
// @access  Private (Admin only)
const getAIStats = async (req, res, next) => {
  try {
    const totalQueries = await AiLogs.count();
    const successfulQueries = await AiLogs.count({ where: { status: 'success' } });
    const failedQueries = await AiLogs.count({ where: { status: 'error' } });

    // Queries by type
    const queriesByType = await AiLogs.findAll({
      attributes: [
        'queryType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['queryType']
    });

    // Average response time
    const avgResponseTime = await AiLogs.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('response_time')), 'avgTime']]
    });

    // Top users by AI usage
    const topAiUsers = await AiLogs.findAll({
      attributes: [
        'userId',
        [sequelize.fn('COUNT', sequelize.col('AiLog.id')), 'queryCount']
      ],
      group: ['userId'],
      order: [[sequelize.literal('queryCount'), 'DESC']],
      limit: 10,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });

    // Recent AI queries
    const recentQueries = await AiLogs.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'role']
      }],
      attributes: ['id', 'queryType', 'prompt', 'status', 'createdAt', 'responseTime']
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalQueries,
          successfulQueries,
          failedQueries,
          successRate: totalQueries > 0 ? ((successfulQueries / totalQueries) * 100).toFixed(2) : 0,
          avgResponseTime: parseInt(avgResponseTime?.dataValues?.avgTime || 0)
        },
        queriesByType,
        topUsers: topAiUsers.map(u => ({
          user: u.user,
          queryCount: parseInt(u.dataValues.queryCount)
        })),
        recentQueries
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system activity logs
// @route   GET /api/admin/activity
// @access  Private (Admin only)
const getActivityLogs = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    // Get recent users
    const recentUsers = await User.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'role', 'createdAt']
    });

    // Get recent cases
    const recentCases = await Case.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'client', attributes: ['id', 'name'] }
      ],
      attributes: ['id', 'title', 'caseNumber', 'status', 'createdAt']
    });

    // Get recent messages
    const recentMessages = await Message.findAll({
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'role'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'role'] }
      ],
      attributes: ['id', 'message', 'messageType', 'createdAt']
    });

    res.json({
      success: true,
      data: {
        recentUsers,
        recentCases,
        recentMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  getAllCasesAdmin,
  assignLawyerToCase,
  deleteCaseAdmin,
  getAIStats,
  getActivityLogs
};