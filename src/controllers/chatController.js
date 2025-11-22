// src/controllers/chatController.js (Prisma Version)
const { prisma } = require('../config/prisma');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, caseId, messageType, attachmentUrl } = req.body;
    const senderId = req.user.id;

    // Validate receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // If caseId provided, verify access
    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId }
      });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Verify sender is part of the case
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

      // Verify receiver is part of the case
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

    // Create message
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
        sender: {
          select: { id: true, name: true, email: true, role: true, profilePicture: true }
        },
        receiver: {
          select: { id: true, name: true, email: true, role: true, profilePicture: true }
        },
        case: {
          select: { id: true, title: true, caseNumber: true }
        }
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

// @desc    Get conversation between two users
// @route   GET /api/messages/conversation/:userId
// @access  Private
const getConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    const { caseId, limit = 50, offset = 0 } = req.query;

    const where = {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    };

    if (caseId) {
      where.caseId = parseInt(caseId);
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where,
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, profilePicture: true, role: true }
        },
        receiver: {
          select: { id: true, name: true, profilePicture: true, role: true }
        }
      }
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        receiverId: currentUserId,
        senderId: otherUserId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
const getAllConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all unique users current user has conversed with
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

    // Combine and get unique user IDs
    const userIds = new Set([
      ...sentMessages.map(m => m.receiverId),
      ...receivedMessages.map(m => m.senderId)
    ]);

    // Get conversation details for each user
    const conversations = await Promise.all(
      Array.from(userIds).map(async (otherUserId) => {
        // Get last message
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId }
            ]
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, profilePicture: true, role: true }
            },
            receiver: {
              select: { id: true, name: true, profilePicture: true, role: true }
            },
            case: {
              select: { id: true, title: true, caseNumber: true }
            }
          }
        });

        // Get other user details
        const otherUser = lastMessage.senderId === userId 
          ? lastMessage.receiver 
          : lastMessage.sender;

        // Count unread messages from this user
        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            isRead: false
          }
        });

        return {
          user: otherUser,
          lastMessage: {
            id: lastMessage.id,
            message: lastMessage.message,
            messageType: lastMessage.messageType,
            createdAt: lastMessage.createdAt,
            isRead: lastMessage.isRead
          },
          case: lastMessage.case,
          unreadCount
        };
      })
    );

    // Sort by last message time
    conversations.sort((a, b) => 
      new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );

    res.json({
      success: true,
      data: {
        conversations,
        count: conversations.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a specific case
// @route   GET /api/messages/case/:caseId
// @access  Private
const getCaseMessages = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Verify case access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check authorization
    const isAuthorized = 
      caseData.clientId === userId || 
      caseData.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view messages for this case'
      });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { caseId },
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, profilePicture: true, role: true }
        },
        receiver: {
          select: { id: true, name: true, profilePicture: true, role: true }
        }
      }
    });

    // Mark messages as read for current user
    await prisma.message.updateMany({
      where: {
        caseId,
        receiverId: userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id);
    const userId = req.user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only receiver can mark as read
    if (message.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read'
      });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message (soft delete)
// @route   DELETE /api/messages/:id
// @access  Private
const deleteMessage = async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id);
    const userId = req.user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender or admin can delete
    if (message.senderId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedBy: userId
      }
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const unreadCount = await prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getAllConversations,
  getCaseMessages,
  markAsRead,
  deleteMessage,
  getUnreadCount
};