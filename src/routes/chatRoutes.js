// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getAllConversations,
  getCaseMessages,
  markAsRead,
  deleteMessage,
  getUnreadCount
} = require('../controllers/chatController');
const { sendMessageValidation } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Send message
router.post('/', sendMessageValidation, sendMessage);

// Get all conversations
router.get('/conversations', getAllConversations);

// // Get unread count
// router.get('/unread/count', getUnreadCount);

// // Get conversation with specific user
// router.get('/conversation/:userId', getConversation);

// // Get messages for a case
// router.get('/case/:caseId', getCaseMessages);

// // Mark message as read
// router.put('/:id/read', markAsRead);

// // Delete message
// router.delete('/:id', deleteMessage);

module.exports = router;