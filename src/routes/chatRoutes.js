// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getAllConversations,
  getUnreadCount,
  getCaseMessages  // ✅ Import new controller
} = require('../controllers/chatController');
const { sendMessageValidation } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

router.use(protect);

// Send message
router.post('/', sendMessageValidation, sendMessage);

// Get all conversations
router.get('/conversations', getAllConversations);

// Get unread count
// router.get('/unread/count', getUnreadCount);

// Get conversation with specific user
router.get('/conversation/:userId', getConversation);

// ✅ Get messages for a specific case
router.get('/case/:caseId', getCaseMessages);

// Other routes remain commented if not needed
// router.put('/:id/read', markAsRead);
// router.delete('/:id', deleteMessage);

module.exports = router;