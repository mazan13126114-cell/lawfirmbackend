const { prisma } = require('../config/prisma');

// =======================
// Send a message
// =======================
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, caseId, messageType, attachmentUrl } = req.body;
    const senderId = req.user.id; // <-- sender comes from authenticated token, must be trusted

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId } // <-- risk if someone sends a fake receiverId
    });
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // If sending within a case, check case existence & access
    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId } // <-- validate numeric caseId
      });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Verify sender is part of the case or admin
      const isSenderAuthorized = 
        caseData.clientId === senderId || 
        caseData.lawyerId === senderId ||
        req.user.role === 'admin';
      if (!isSenderAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to send messages for this case'
        });
      }

      // Verify receiver is part of the case or admin
      const isReceiverAuthorized = 
        caseData.clientId === receiverId || 
        caseData.lawyerId === receiverId ||
        receiver.role === 'admin';
      if (!isReceiverAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Receiver is not part of this case'
        });
      }
    }

    // Create message record
    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        caseId: caseId || null,
        message,
        messageType: messageType || 'text',
        attachmentUrl: attachmentUrl || null
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true, profilePicture: true } },
        receiver: { select: { id: true, name: true, email: true, role: true, profilePicture: true } },
        case: { select: { id: true, title: true, caseNumber: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: newMessage }
    });
  } catch (error) {
    next(error);
  }
};

// =======================
// Get conversation with one user
// =======================

const getConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId); // <-- parse to ensure numeric ID
    const { caseId, limit = 50, offset = 0 } = req.query;

    // Query messages where either user is sender/receiver
    const where = {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    };
    if (caseId) where.caseId = parseInt(caseId);

    // Get messages including sender & receiver info
    const messages = await prisma.message.findMany({
      where,
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, profilePicture: true, role: true } },
        receiver: { select: { id: true, name: true, profilePicture: true, role: true } }
      }
    });

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        receiverId: currentUserId,
        senderId: otherUserId,
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
    });

    res.json({
      success: true,
      data: { messages, count: messages.length }
    });
  } catch (error) {
    next(error);
  }
};

// =======================
// Get all conversations for current user
// =======================

const getAllConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get unique user IDs of all conversation partners
    const sentMessages = await prisma.message.findMany({
      where: { senderId: userId },
      distinct: ['receiverId'],
      select: { receiverId: true }
    });
    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: userId },
      distinct: ['senderId'],
      select: { senderId: true }
    });

    const userIds = new Set([
      ...sentMessages.map(m => m.receiverId),
      ...receivedMessages.map(m => m.senderId)
    ]);

    // Build conversation details
    const conversations = await Promise.all(
      Array.from(userIds).map(async (otherUserId) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId }
            ]
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true, profilePicture: true, role: true } },
            receiver: { select: { id: true, name: true, profilePicture: true, role: true } },
            case: { select: { id: true, title: true, caseNumber: true } }
          }
        });

        // Determine the “other user” object
        const otherUser = lastMessage.senderId === userId ? lastMessage.receiver : lastMessage.sender;

        // Count unread messages from this user
        const unreadCount = await prisma.message.count({
          where: { senderId: otherUserId, receiverId: userId, isRead: false }
        });

        return { user: otherUser, lastMessage, case: lastMessage.case, unreadCount };
      })
    );

    // Sort by last message timestamp
    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ success: true, data: { conversations, count: conversations.length } });
  } catch (error) {
    next(error);
  }
};

// =======================
// Key notes for me ofcourse:
// 1. Always parse numeric IDs from request params/queries.
// 2. Always validate sender/receiver against the case if provided.
// 3. Soft deletes are safer for messages.
// 4. Authorization checks are critical for privacy/security.
// =======================

module.exports = {
  sendMessage,
  getConversation,
  getAllConversations,
};
