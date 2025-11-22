// src/controllers/caseController.js (Prisma Version)
const { prisma } = require('../config/prisma');

// @desc    Create new case
// @route   POST /api/cases
// @access  Private (Client only)
const createCase = async (req, res, next) => {
  try {
    const { title, description, caseType, priority } = req.body;

    // Only clients can create cases
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can create cases'
      });
    }

    // Generate unique case number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const caseNumber = `CASE-${timestamp}-${random}`;

    // Create case
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
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Case created successfully',
      data: { case: newCase }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all cases (with filters)
// @route   GET /api/cases
// @access  Private
const getAllCases = async (req, res, next) => {
  try {
    const { status, caseType, priority, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause based on user role
    const where = {};

    if (req.user.role === 'client') {
      where.clientId = req.user.id;
    } else if (req.user.role === 'lawyer') {
      where.lawyerId = req.user.id;
    }
    // Admin sees all cases (no filter)

    // Add filters
    if (status) where.status = status;
    if (caseType) where.caseType = caseType;
    if (priority) where.priority = priority;
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { caseNumber: { contains: search } }
      ];
    }

    // Get cases with pagination
    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          lawyer: {
            select: {
              id: true,
              name: true,
              email: true,
              specialization: true
            }
          }
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

// @desc    Get single case by ID
// @route   GET /api/cases/:id
// @access  Private
const getCaseById = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true
          }
        },
        lawyer: {
          select: {
            id: true,
            name: true,
            email: true,
            specialization: true,
            experience: true,
            licenseNumber: true
          }
        },
        documents: {
          include: {
            uploader: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check authorization
    if (req.user.role === 'client' && caseData.clientId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this case'
      });
    }

    if (req.user.role === 'lawyer' && caseData.lawyerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this case'
      });
    }

    res.json({
      success: true,
      data: { case: caseData }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update case
// @route   PUT /api/cases/:id
// @access  Private (Client owns case or Lawyer assigned or Admin)
const updateCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);
    const { title, description, status, priority, caseType, notes, caseOutcome, courtName, filingDate } = req.body;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Authorization check
    const isClient = req.user.role === 'client' && caseData.clientId === req.user.id;
    const isLawyer = req.user.role === 'lawyer' && caseData.lawyerId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isClient && !isLawyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this case'
      });
    }

    // Prepare update data
    const updateData = {};

    // Clients can only update certain fields if case is pending
    if (isClient) {
      if (caseData.status !== 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Cannot update case after it has been assigned'
        });
      }
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (caseType) updateData.caseType = caseType;
      if (priority) updateData.priority = priority;
    }

    // Lawyers and admins can update more fields
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
      
      // Auto-set closing date when status is closed
      if (status === 'closed' && !caseData.closingDate) {
        updateData.closingDate = new Date();
        
        // Calculate actual duration
        const diffTime = Math.abs(new Date() - new Date(caseData.createdAt));
        updateData.actualDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true, email: true }
        },
        lawyer: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Case updated successfully',
      data: { case: updatedCase }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign lawyer to case
// @route   PUT /api/cases/:id/assign
// @access  Private (Admin or Lawyer can self-assign)
const assignLawyer = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);
    const { lawyerId } = req.body;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check if case already has a lawyer
    if (caseData.lawyerId) {
      return res.status(400).json({
        success: false,
        message: 'Case already has an assigned lawyer'
      });
    }

    // Determine which lawyer to assign
    let targetLawyerId = lawyerId;

    // If lawyer is self-assigning
    if (req.user.role === 'lawyer' && !lawyerId) {
      targetLawyerId = req.user.id;
    }

    // Only admin can assign other lawyers
    if (req.user.role !== 'admin' && targetLawyerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can assign other lawyers'
      });
    }

    // Verify the lawyer exists
    const lawyer = await prisma.user.findUnique({
      where: { 
        id: targetLawyerId,
        role: 'lawyer'
      }
    });

    if (!lawyer) {
      return res.status(404).json({
        success: false,
        message: 'Lawyer not found'
      });
    }

    // Assign lawyer and update status
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        lawyerId: targetLawyerId,
        status: 'assigned'
      },
      include: {
        client: {
          select: { id: true, name: true, email: true }
        },
        lawyer: {
          select: { id: true, name: true, email: true, specialization: true }
        }
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
// @route   DELETE /api/cases/:id
// @access  Private (Admin only or Client if pending)
const deleteCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.id);

    const caseData = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Authorization
    const isAdmin = req.user.role === 'admin';
    const isClientWithPending = 
      req.user.role === 'client' && 
      caseData.clientId === req.user.id && 
      caseData.status === 'pending';

    if (!isAdmin && !isClientWithPending) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this case'
      });
    }

    // Delete case (will cascade delete related messages, documents, etc.)
    await prisma.case.delete({
      where: { id: caseId }
    });

    res.json({
      success: true,
      message: 'Case deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get case statistics
// @route   GET /api/cases/stats/overview
// @access  Private
const getCaseStats = async (req, res, next) => {
  try {
    const where = {};

    // Role-based filtering
    if (req.user.role === 'client') {
      where.clientId = req.user.id;
    } else if (req.user.role === 'lawyer') {
      where.lawyerId = req.user.id;
    }

    // Get counts
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
      prisma.case.aggregate({
        where,
        _avg: {
          probabilityScore: true
        }
      })
    ]);

    // Get cases by type
    const casesByType = await prisma.case.groupBy({
      by: ['caseType'],
      where,
      _count: true
    });

    res.json({
      success: true,
      data: {
        totalCases,
        pendingCases,
        assignedCases,
        ongoingCases,
        closedCases,
        averageProbability: avgProbability._avg.probabilityScore 
          ? parseFloat(avgProbability._avg.probabilityScore).toFixed(2)
          : '0.00',
        casesByType: casesByType.map(item => ({
          type: item.caseType,
          count: item._count
        }))
      }
    });
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
  deleteCase,
  getCaseStats
};