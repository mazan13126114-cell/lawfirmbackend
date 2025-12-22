const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get public list of lawyers with optional specialization filter
const getLawyers = async (req, res, next) => {
  try {
    const { specialization, search, page = 1, limit = 50 } = req.query;
    const where = { role: 'lawyer' };

    if (specialization) {
      where.specialization = { contains: specialization, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { specialization: { contains: search, mode: 'insensitive' } }
      ];
    }

    const offset = (page - 1) * limit;

    const users = await prisma.user.findMany({
      where,
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        specialization: true,
        licenseNumber: true,
        experience: true,
        profilePicture: true,
        createdAt: true
      }
    });

    res.json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLawyers
};
