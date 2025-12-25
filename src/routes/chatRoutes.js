// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getAllConversations,

  getCaseMessages  
} = require('../controllers/chatController');
const { sendMessageValidation } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

router.use(protect);

// Send message
router.post('/', sendMessageValidation, sendMessage);

// Get all conversations
router.get('/conversations', getAllConversations);



// Get conversation with specific user
router.get('/conversation/:userId', getConversation);

//  Get messages for a specific case
router.get('/case/:caseId', getCaseMessages);


module.exports = router;