// src/controllers/adminController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res, next) => {
  try {
    // Total counts
  const totalUsers = await prisma.user.count();
  const totalClients = await prisma.user.count({ where: { role: 'client' } });
  const totalLawyers = await prisma.user.count({ where: { role: 'lawyer' } });
  const totalCases = await prisma.case.count();
  const totalMessages = await prisma.message.count();
  const totalDocuments = await prisma.document.count();
  const totalAiQueries = await prisma.aiLog.count();

    // Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.count({
      where: {
        lastLogin: { gte: thirtyDaysAgo }
      }
    });

    // Case status breakdown
    const casesByStatusRaw = await prisma.case.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const casesByStatus = casesByStatusRaw.map(row => ({ status: row.status, count: row._count.id }));

    // Cases by type
    const casesByTypeRaw = await prisma.case.groupBy({
      by: ['caseType'],
      _count: { id: true }
    });
    const casesByType = casesByTypeRaw.map(row => ({ caseType: row.caseType, count: row._count.id }));

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCases = await prisma.case.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });
    const recentMessages = await prisma.message.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });
    const recentUsers = await prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });

    // Average case probability
    const avgProbabilityRaw = await prisma.case.aggregate({
      _avg: { probability_score: true }
    });
    const avgProbability = avgProbabilityRaw._avg.probability_score;

    // Cases with lawyers vs without
  const assignedCases = await prisma.case.count({ where: { lawyerId: { not: null } } });
  const unassignedCases = await prisma.case.count({ where: { lawyerId: null } });

    // Top lawyers by case count
    const topLawyersRaw = await prisma.case.groupBy({
      by: ['lawyerId'],
      where: { lawyerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });
    const topLawyers = await Promise.all(topLawyersRaw.map(async l => {
      const lawyer = await prisma.user.findUnique({
        where: { id: l.lawyerId },
        select: { id: true, name: true, email: true, specialization: true }
      });
      return { lawyer, caseCount: l._count.id };
    }));

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
        topLawyers
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
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ];
    }
    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: { password: false }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
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

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        // Add more fields as needed
      }
    });
    // Get clientCases and lawyerCases
    const clientCases = await prisma.case.findMany({
      where: { clientId: parseInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    const lawyerCases = await prisma.case.findMany({
      where: { lawyerId: parseInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional stats
  const messagesSent = await prisma.message.count({ where: { senderId: parseInt(userId) } });
  const messagesReceived = await prisma.message.count({ where: { receiverId: parseInt(userId) } });
  const documentsUploaded = await prisma.document.count({ where: { uploadedBy: parseInt(userId) } });
  const aiQueriesCount = await prisma.aiLog.count({ where: { userId: parseInt(userId) } });

    res.json({
      success: true,
      data: {
        user: { ...user, clientCases, lawyerCases },
        stats: {
          messagesSent,
          messagesReceived,
          documentsUploaded,
          aiQueriesCount,
          totalCases: user.role === 'client' ? clientCases.length : lawyerCases.length
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

  const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
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

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'User updated successfully',
  data: { user: updatedUser }
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

  const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
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

  await prisma.user.delete({ where: { id: parseInt(userId) } });

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
      where.OR = [
        { title: { contains: search } },
        { caseNumber: { contains: search } }
      ];
    }
    const [cases, count] = await Promise.all([
      prisma.case.findMany({
        where,
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, email: true } },
          lawyer: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.case.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        cases,
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

  const caseData = await prisma.case.findUnique({ where: { id: parseInt(caseId) } });
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Verify lawyer exists
    const lawyer = await prisma.user.findFirst({ where: { id: lawyerId, role: 'lawyer' } });

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found'
      });
    }

    await prisma.case.update({
      where: { id: parseInt(caseId) },
      data: { lawyerId, status: 'assigned' }
    });

    const updatedCase = await prisma.case.findUnique({
      where: { id: parseInt(caseId) },
      include: {
        client: { select: { id: true, name: true, email: true } },
        lawyer: { select: { id: true, name: true, email: true } }
      }
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

  const caseData = await prisma.case.findUnique({ where: { id: parseInt(caseId) } });
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

  await prisma.case.delete({ where: { id: parseInt(caseId) } });

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
  const totalQueries = await prisma.aiLog.count();
  const successfulQueries = await prisma.aiLog.count({ where: { status: 'success' } });
  const failedQueries = await prisma.aiLog.count({ where: { status: 'error' } });

    // Queries by type
    const queriesByTypeRaw = await prisma.aiLog.groupBy({
      by: ['queryType'],
      _count: { id: true }
    });
    const queriesByType = queriesByTypeRaw.map(row => ({ queryType: row.queryType, count: row._count.id }));

    // Average response time
    const avgResponseTimeRaw = await prisma.aiLog.aggregate({
      _avg: { responseTime: true }
    });
    const avgResponseTime = avgResponseTimeRaw._avg.responseTime;

    // Top users by AI usage
    const topAiUsersRaw = await prisma.aiLog.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });
    const topAiUsers = await Promise.all(topAiUsersRaw.map(async u => {
      const user = await prisma.user.findUnique({
        where: { id: u.userId },
        select: { id: true, name: true, email: true, role: true }
      });
      return { user, queryCount: u._count.id };
    }));

    // Recent AI queries
    const recentQueries = await prisma.aiLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true } }
      },
      select: { id: true, queryType: true, prompt: true, status: true, createdAt: true, responseTime: true, user: true }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalQueries,
          successfulQueries,
          failedQueries,
          successRate: totalQueries > 0 ? ((successfulQueries / totalQueries) * 100).toFixed(2) : 0,
          avgResponseTime: parseInt(avgResponseTime || 0)
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
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    // Get recent cases
    const recentCases = await prisma.case.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } }
      },
      select: { id: true, title: true, caseNumber: true, status: true, createdAt: true, client: true }
    });

    // Get recent messages
    const recentMessages = await prisma.message.findMany({
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } }
      },
      select: { id: true, message: true, messageType: true, createdAt: true, sender: true, receiver: true }
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