// src/controllers/chatController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =======================
// Send a message
// =======================
const sendMessage = async (req, res, next) => {
  try {
    let { receiverId, message, caseId, messageType, attachmentUrl, recipientId, content } = req.body;
    if (!receiverId && recipientId) receiverId = recipientId;
    if (!message && content) message = content;
    const senderId = req.user.id;

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: parseInt(caseId, 10) }
      });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

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

    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        caseId: caseId ? parseInt(caseId, 10) : null,
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
// Get messages for a specific case
// =======================
const getCaseMessages = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const userId = req.user.id;

    const caseData = await prisma.case.findUnique({ 
      where: { id: caseId },
      select: { clientId: true, lawyerId: true }
    });

    if (!caseData || 
        (req.user.role === 'client' && caseData.clientId !== userId) ||
        (req.user.role === 'lawyer' && caseData.lawyerId !== userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const messages = await prisma.message.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, role: true } }
      }
    });

    res.json({ success: true, data: { messages } });
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
    const otherUserId = parseInt(req.params.userId);
    const { caseId, limit = 50, offset = 0 } = req.query;

    const where = {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    };
    if (caseId) where.caseId = parseInt(caseId);

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
// Get all conversations for current user (grouped by user AND case)
// =======================
const getAllConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const allMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, profilePicture: true, role: true } },
        receiver: { select: { id: true, name: true, profilePicture: true, role: true } },
        case: { select: { id: true, title: true, caseNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const conversationMap = new Map();

    for (const msg of allMessages) {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      const caseId = msg.caseId || null;
      const key = `${otherUser.id}-${caseId}`;

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          user: otherUser,
          lastMessage: msg,
          case: msg.case,
          caseId: msg.caseId
        });
      }
    }

    const conversations = await Promise.all(
      Array.from(conversationMap.values()).map(async (conv) => {
        const unreadWhere = {
          senderId: conv.user.id,
          receiverId: userId,
          isRead: false
        };
        
        if (conv.caseId) {
          unreadWhere.caseId = conv.caseId;
        } else {
          unreadWhere.caseId = null;
        }

        const unreadCount = await prisma.message.count({ where: unreadWhere });

        return { ...conv, unreadCount };
      })
    );

    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ success: true, data: { conversations, count: conversations.length } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getCaseMessages,
  getConversation,
  getAllConversations
};
