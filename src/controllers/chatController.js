// src/controllers/chatController.js
const { prisma } = require('@prisma/client');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, message, caseId, messageType, attachmentUrl } = req.body;
    const senderId = req.user.id;

    // Validate receiver exists
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // If caseId provided, verify access
    if (caseId) {
      const caseData = await prisma.case.findUnique({ where: { id: caseId } });
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
      }
    });
    // Fetch sender/receiver/case details
    const messageWithDetails = await prisma.message.findUnique({
      where: { id: newMessage.id },
      include: {
        sender: true,
        receiver: true,
        case: true
      }
    });

    // TODO: Emit socket event for real-time notification
    // io.to(receiverId).emit('new_message', messageWithDetails);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: messageWithDetails }
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

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId }
        ],
        ...(caseId ? { caseId: Number(caseId) } : {})
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
        receiver: true
      }
    });

    // Mark messages as read
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

    // Get all users current user has conversed with
    const conversations = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      attributes: [
        [Message.sequelize.fn('MAX', Message.sequelize.col('id')), 'lastMessageId'],
        [Message.sequelize.fn('MAX', Message.sequelize.col('created_at')), 'lastMessageTime']
      ],
      group: [
        Message.sequelize.literal(`CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END`)
      ],
      order: [[Message.sequelize.literal('lastMessageTime'), 'DESC']],
      raw: true
    });

    // Get detailed info for each conversation
    const conversationDetails = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = conv.lastMessageId ? await Message.findByPk(conv.lastMessageId, {
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'profilePicture', 'role'] },
            { model: User, as: 'receiver', attributes: ['id', 'name', 'profilePicture', 'role'] },
            { model: Case, as: 'case', attributes: ['id', 'title', 'caseNumber'] }
          ]
          }) : null;

          // If there's no lastMessage (edge case), skip this conversation
          if (!lastMessage) {
            return null;
          }

          // Determine the other user
          const otherUser = lastMessage.senderId === userId ? lastMessage.receiver : lastMessage.sender;

          // Count unread messages from this user
          const unreadCount = await Message.count({
            where: {
              senderId: otherUser.id,
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
      // Remove any null entries caused by missing lastMessage
      const filtered = conversationDetails.filter(c => c !== null);

      res.json({
        success: true,
        data: {
          conversations: filtered,
          count: filtered.length
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
    const caseId = req.params.caseId;
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Verify case access
  const caseData = await prisma.case.findUnique({ where: { id: Number(caseId) } });
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

    const messages = await prisma.message.findMany({
      where: { caseId: Number(caseId) },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: true,
        receiver: true
      }
    });

    // Mark messages as read for current user
    await prisma.message.updateMany({
      where: {
        caseId: Number(caseId),
        receiverId: userId,
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
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
    const messageId = req.params.id;
    const userId = req.user.id;

  const message = await prisma.message.findUnique({ where: { id: Number(messageId) } });
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
      where: { id: Number(messageId) },
      data: { isRead: true, readAt: new Date() }
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
    const messageId = req.params.id;
    const userId = req.user.id;

  const message = await prisma.message.findUnique({ where: { id: Number(messageId) } });
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
      where: { id: Number(messageId) },
      data: { isDeleted: true, deletedBy: userId }
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