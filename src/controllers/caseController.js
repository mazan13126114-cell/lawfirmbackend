/* =========================================================================
   Handles operations for cases, assigning lawyers,
   and fetching statistics related to cases.
   ================================================================= */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* =========================================================================
    Create new case
   ================================================================= */
const createCase = async (req, res, next) => {
  try {
    const { title, description, caseType, priority } = req.body;

    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can create cases' });
    }

    // Generate unique case number
    const caseNumber = `CASE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newCase = await prisma.case.create({
      data: {
        clientId: req.user.id,
        caseNumber,
        title,
        description,
        caseType,
        priority: priority || 'medium',
        status: 'pending'
      },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } }
      }
    });

    res.status(201).json({ success: true, message: 'Case created successfully', data: { case: newCase } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
  Get all cases with optional filters and pagination
   ================================================================= */
const getAllCases = async (req, res, next) => {
  try {
    const { status, caseType, priority, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Role-based filtering
    if (req.user.role === 'client') where.clientId = req.user.id;
    if (req.user.role === 'lawyer') where.lawyerId = req.user.id;

    // Additional filters
    if (status) where.status = status;
    if (caseType) where.caseType = caseType;
    if (priority) where.priority = priority;
    if (search) where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { caseNumber: { contains: search } }
    ];

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          lawyer: { select: { id: true, name: true, email: true, specialization: true } }
        }
      }),
      prisma.case.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        cases,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Get single case by ID
   ================================================================= */
const getCaseById = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, address: true } },
        lawyer: { select: { id: true, name: true, email: true, specialization: true, experience: true, licenseNumber: true } },
        // documents removed from response (document features disabled)
        messages: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

    // Authorization check
    if ((req.user.role === 'client' && caseData.clientId !== req.user.id) ||
        (req.user.role === 'lawyer' && caseData.lawyerId !== req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this case' });
    }

    res.json({ success: true, data: { case: caseData } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
    Update case
   ================================================================= */
const updateCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);
    const { title, description, status, priority, caseType, notes, caseOutcome, courtName, filingDate } = req.body;

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

    const isClient = req.user.role === 'client' && caseData.clientId === req.user.id;
    const isLawyer = req.user.role === 'lawyer' && caseData.lawyerId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isClient && !isLawyer && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized to update this case' });

    const updateData = {};

    // Clients can only update before assignment
    if (isClient) {
      if (caseData.status !== 'pending') return res.status(403).json({ success: false, message: 'Cannot update case after assignment' });
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (caseType) updateData.caseType = caseType;
      if (priority) updateData.priority = priority;
    }

    // Lawyers and admins can update all fields
    if (isLawyer || isAdmin) {
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (caseType) updateData.caseType = caseType;
      if (notes) updateData.notes = notes;
      if (caseOutcome) updateData.caseOutcome = caseOutcome;
      if (courtName) updateData.courtName = courtName;
      if (filingDate) updateData.filingDate = new Date(filingDate);

      if (status === 'closed' && !caseData.closingDate) {
        updateData.closingDate = new Date();
        updateData.actualDuration = Math.ceil(Math.abs(new Date() - new Date(caseData.createdAt)) / (1000 * 60 * 60 * 24));
      }
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        lawyer: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ success: true, message: 'Case updated successfully', data: { case: updatedCase } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
    Assign lawyer to case
   ================================================================= */
const assignLawyer = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);
    let { lawyerId } = req.body;

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

    if (caseData.lawyerId) return res.status(400).json({ success: false, message: 'Case already has an assigned lawyer' });

    // Lawyer self-assign
    if (req.user.role === 'lawyer' && !lawyerId) lawyerId = req.user.id;

    // Only admin can assign others
    if (req.user.role !== 'admin' && lawyerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only admins can assign other lawyers' });
    }

    const lawyer = await prisma.user.findUnique({ where: { id: lawyerId, role: 'lawyer' } });
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: { lawyerId, status: 'assigned' },
      include: {
        client: { select: { id: true, name: true, email: true } },
        lawyer: { select: { id: true, name: true, email: true, specialization: true } }
      }
    });

    res.json({ success: true, message: 'Lawyer assigned successfully', data: { case: updatedCase } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
    Delete case
   ================================================================= */
const deleteCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);
    const caseData = await prisma.case.findUnique({ where: { id: caseId } });

    if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

    const isAdmin = req.user.role === 'admin';
    const isClientWithPending = req.user.role === 'client' && caseData.clientId === req.user.id && caseData.status === 'pending';

    if (!isAdmin && !isClientWithPending) return res.status(403).json({ success: false, message: 'Not authorized to delete this case' });

    await prisma.case.delete({ where: { id: caseId } });

    res.json({ success: true, message: 'Case deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
    Get case statistics
   ================================================================= */
const getCaseStats = async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role === 'client') where.clientId = req.user.id;
    if (req.user.role === 'lawyer') where.lawyerId = req.user.id;

    const [
      totalCases,
      pendingCases,
      assignedCases,
      ongoingCases,
      closedCases,
      avgProbability
    ] = await Promise.all([
      prisma.case.count({ where }),
      prisma.case.count({ where: { ...where, status: 'pending' } }),
      prisma.case.count({ where: { ...where, status: 'assigned' } }),
      prisma.case.count({ where: { ...where, status: 'ongoing' } }),
      prisma.case.count({ where: { ...where, status: 'closed' } }),
      prisma.case.aggregate({ where, _avg: { probabilityScore: true } })
    ]);

    const casesByType = await prisma.case.groupBy({ by: ['caseType'], where, _count: true });

    res.json({
      success: true,
      data: {
        totalCases,
        pendingCases,
        assignedCases,
        ongoingCases,
        closedCases,
        averageProbability: avgProbability._avg.probabilityScore ? parseFloat(avgProbability._avg.probabilityScore).toFixed(2) : '0.00',
        casesByType: casesByType.map(item => ({ type: item.caseType, count: item._count }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Get pending case requests for lawyers
   ================================================================= */
const getPendingRequests = async (req, res, next) => {
  try {
    // Lawyers should see pending cases that are unassigned or explicitly targeted
    const where = { status: 'pending' };

    // If lawyer requests, show only unassigned cases (they can self-assign)
    if (req.user.role === 'lawyer') where.lawyerId = null;

    const requests = await prisma.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true, email: true } } }
    });

    res.json({ success: true, data: { requests, count: requests.length } });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   Reject a pending case request (lawyer/admin)
   ================================================================= */
const rejectCaseRequest = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

    // Only pending cases may be rejected
    if (caseData.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending cases can be rejected' });

    // If lawyer, allow reject only for unassigned cases
    if (req.user.role === 'lawyer' && caseData.lawyerId) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this case' });
    }

    const updated = await prisma.case.update({ where: { id: caseId }, data: { status: 'rejected' } });

    // Optionally: create a notification or message to the client (omitted for simplicity)

    res.json({ success: true, message: 'Case request rejected', data: { case: updated } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  assignLawyer,
  getPendingRequests,
  rejectCaseRequest,
  deleteCase,
  getCaseStats
};
