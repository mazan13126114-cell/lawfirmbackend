/* =======================================================================
    Admin Controller
   ======================================================================= */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* ===========================================================
   - Total user counts
   - Case distribution
   - Recent activity (nah couldn't finish in time)
   - Top performing lawyers
   =========================================================== */
const getDashboardStats = async (req, res, next) => {
  try {
    //  Basic numbers every admin cares about
    const totalUsers = await prisma.user.count();
    const totalClients = await prisma.user.count({ where: { role: 'client' } });
    const totalLawyers = await prisma.user.count({ where: { role: 'lawyer' } });
    const totalCases = await prisma.case.count();
    const totalMessages = await prisma.message.count();
    // document features removed — do not query documents table
    const totalAiQueries = await prisma.aiLog.count();

    //  Active users → logged in within last 30 days (Used AI to get this)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.count({
      where: { lastLogin: { gte: thirtyDaysAgo } }
    });

    //  Breakdown: cases grouped by status (pending, closed, assigned, etc.)
    const casesByStatusRaw = await prisma.case.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const casesByStatus = casesByStatusRaw.map(row => ({
      status: row.status,
      count: row._count.id
    }));

    //  Breakdown: cases grouped by type (Criminal, Civil, Family...)
    const casesByTypeRaw = await prisma.case.groupBy({
      by: ['caseType'],
      _count: { id: true }
    });
    const casesByType = casesByTypeRaw.map(row => ({
      caseType: row.caseType,
      count: row._count.id
    }));

    //  Recent activity (past 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCases = await prisma.case.count({ where: { createdAt: { gte: sevenDaysAgo } } });
    const recentMessages = await prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo } } });
    const recentUsers = await prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } });

    //  Average probability score from AI case predictions (if i find time then i will add this too)
    const avgProbabilityRaw = await prisma.case.aggregate({
      _avg: { probabilityScore: true }
    });
    const avgProbability = avgProbabilityRaw._avg.probabilityScore;

    //  Number of cases assigned versus unassigned
    const assignedCases = await prisma.case.count({ where: { lawyerId: { not: null } } });
    const unassignedCases = await prisma.case.count({ where: { lawyerId: null } });

    //  Basic dashboard stats
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalClients,
          totalLawyers,
          totalCases,
          totalMessages,
          totalAiQueries,
          activeUsers
        },
        cases: {
          total: totalCases,
          assigned: assignedCases,
          unassigned: unassignedCases,
          byStatus: casesByStatus,
          byType: casesByType,
          avgProbability: parseFloat(avgProbability || 0).toFixed(2)
        },
        recentActivity: {
          newCases: recentCases,
          newMessages: recentMessages,
          newUsers: recentUsers
        }
        
      }
    });
  } catch (error) {
    next(error);
  }
};


/* ===========================================================
    GET ALL USERS (With Search + Filters(filter is getting too much complex so not gonna use it))
   =========================================================== */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, search, specialization, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    //  Build dynamic filtering based on query params
    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } }
      ];
    }


    //  REMOVED: specialization filter (not commonly used)
    // if (specialization) {
    //   where.specialization = { contains: specialization };
    // }

    //  Fetch all users + total count
    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true
        }
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


module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails: async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const clientCases = await prisma.case.findMany({ where: { clientId: userId }, take: 5, orderBy: { createdAt: 'desc' } });
      const lawyerCases = await prisma.case.findMany({ where: { lawyerId: userId }, take: 5, orderBy: { createdAt: 'desc' } });

      res.json({ success: true, data: { user, clientCases, lawyerCases } });
    } catch (error) { next(error); }
  },

  updateUser: async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive, role, isVerified } = req.body;

      const data = {};
      if (isActive !== undefined) data.isActive = isActive;
      if (role) data.role = role;
      if (isVerified !== undefined) data.isVerified = isVerified;

      const updated = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });
      res.json({ success: true, message: 'User updated', data: { user: updated } });
    } catch (error) { next(error); }
  },

  deleteUser: async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      await prisma.user.delete({ where: { id: userId } });
      res.json({ success: true, message: 'User deleted' });
    } catch (error) { next(error); }
  },

  getAllCasesAdmin: async (req, res, next) => {
    try {
      const { status, caseType, priority, search, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      const where = {};
      if (status) where.status = status;
      if (caseType) where.caseType = caseType;
      if (priority) where.priority = priority;
      if (search) where.OR = [{ title: { contains: search } }, { caseNumber: { contains: search } }];

      const [cases, count] = await Promise.all([
        prisma.case.findMany({ where, skip: parseInt(offset), take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { client: { select: { id: true, name: true } }, lawyer: { select: { id: true, name: true } } } }),
        prisma.case.count({ where })
      ]);

      res.json({ success: true, data: { cases, pagination: { total: count, page: parseInt(page), pages: Math.ceil(count / limit), limit: parseInt(limit) } } });
    } catch (error) { next(error); }
  },

  assignLawyerToCase: async (req, res, next) => {
    try {
      const caseId = parseInt(req.params.id);
      const { lawyerId } = req.body;
      const caseData = await prisma.case.findUnique({ where: { id: caseId } });
      if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

      const lawyer = await prisma.user.findFirst({ where: { id: lawyerId, role: 'lawyer' } });
      if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });

      await prisma.case.update({ where: { id: caseId }, data: { lawyerId, status: 'assigned' } });
      const updated = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true, lawyer: true } });
      res.json({ success: true, message: 'Lawyer assigned', data: { case: updated } });
    } catch (error) { next(error); }
  },

  deleteCaseAdmin: async (req, res, next) => {
    try {
      const caseId = parseInt(req.params.id);
      await prisma.case.delete({ where: { id: caseId } });
      res.json({ success: true, message: 'Case deleted' });
    } catch (error) { next(error); }
  },

  //  REMOVED: AI Stats (not essential for basic admin functionality)
  // getAIStats: async (req, res, next) => {
  //   try {
  //     const totalQueries = await prisma.aiLog.count();
  //     const successfulQueries = await prisma.aiLog.count({ where: { status: 'success' } });
  //     const failedQueries = await prisma.aiLog.count({ where: { status: 'error' } });
  //     const queriesByTypeRaw = await prisma.aiLog.groupBy({ by: ['queryType'], _count: { id: true } });
  //     const queriesByType = queriesByTypeRaw.map(r => ({ queryType: r.queryType, count: r._count.id }));
  //     const avgResponseTime = (await prisma.aiLog.aggregate({ _avg: { responseTime: true } }))._avg.responseTime || 0;
  //     const topAiUsersRaw = await prisma.aiLog.groupBy({ by: ['userId'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 });
  //     const topAiUsers = await Promise.all(topAiUsersRaw.map(async u => ({ user: await prisma.user.findUnique({ where: { id: u.userId }, select: { id: true, name: true, email: true, role: true } }), queryCount: u._count.id })));
  //     const recentQueries = await prisma.aiLog.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, role: true } } }, select: { id: true, queryType: true, prompt: true, status: true, createdAt: true, responseTime: true, user: true } });
  //
  //     res.json({ success: true, data: { overview: { totalQueries, successfulQueries, failedQueries, successRate: totalQueries > 0 ? ((successfulQueries / totalQueries) * 100).toFixed(2) : 0, avgResponseTime: parseInt(avgResponseTime || 0) }, queriesByType, topUsers: topAiUsers, recentQueries } });
  //   } catch (error) { next(error); }
  // },

  //  REMOVED: Activity Logs (redundant with recentActivity in dashboard)
  // getActivityLogs: async (req, res, next) => {
  //   try {
  //     const { limit = 50 } = req.query;
  //     const recentUsers = await prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  //     const recentCases = await prisma.case.findMany({
  //       take: 10,
  //       orderBy: { createdAt: 'desc' },
  //       include: {
  //         client: { select: { id: true, name: true } }
  //       }
  //     });
  //     const recentMessages = await prisma.message.findMany({
  //       take: parseInt(limit),
  //       orderBy: { createdAt: 'desc' },
  //       include: {
  //         sender: { select: { id: true, name: true, role: true } },
  //         receiver: { select: { id: true, name: true, role: true } }
  //       }
  //     });
  //     res.json({ success: true, data: { recentUsers, recentCases, recentMessages } });
  //   } catch (error) { next(error); }
  // }
};