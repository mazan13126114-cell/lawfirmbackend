/* =======================================================================
    Admin Controller
   ======================================================================= */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* ===========================================================
   - Total user counts
   - Case distribution
   - Recent activity
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
    const totalDocuments = await prisma.document.count();
    const totalAiQueries = await prisma.aiLog.count();

    //  Active users → logged in within last 30 days
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

    //  Average probability score from AI case predictions
    const avgProbabilityRaw = await prisma.case.aggregate({
      _avg: { probability_score: true }
    });
    const avgProbability = avgProbabilityRaw._avg.probability_score;

    //  Number of cases assigned versus unassigned
    const assignedCases = await prisma.case.count({ where: { lawyerId: { not: null } } });
    const unassignedCases = await prisma.case.count({ where: { lawyerId: null } });

    //  Top 5 best performing lawyers (based on total handled cases)
    const topLawyersRaw = await prisma.case.groupBy({
      by: ['lawyerId'],
      where: { lawyerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const topLawyers = await Promise.all(
      topLawyersRaw.map(async l => {
        const lawyer = await prisma.user.findUnique({
          where: { id: l.lawyerId },
          select: { id: true, name: true, email: true, specialization: true }
        });
        return { lawyer, caseCount: l._count.id };
      })
    );

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
          avgProbability: parseFloat(avgProbability || 0).toFixed(2)
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


/* ===========================================================
    GET ALL USERS (With Search + Filters)
   =========================================================== */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
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

    //  Fetch paginated users + total count
    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: { password: false } // Hide passwords from response
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
  // getUserDetails,
  // updateUser,
  // deleteUser,
  // getAllCasesAdmin,
  // assignLawyerToCase,
  // deleteCaseAdmin,
  // getAIStats,
  // getActivityLogs
};
