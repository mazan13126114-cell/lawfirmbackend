/* =================================================================
   Handles all AI-related endpoints, including
   chatbot interaction, legal advice, case prediction, document
   analysis, and AI query history.
   ================================================================= */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  sendAIMessage,    // Function to send messages to AI chatbot
  
  analyzeCaseProbability, // Function to predict case success probability
  getLegalDisclaimer   // Function to get disclaimer text for AI responses
} = require('../utils/aiService'); // Import AI service utilities

/* =================================================================
    Chat with AI Assistant
   ================================================================= */
const chatWithAI = async (req, res, next) => {
  try {
    const { message, chatId } = req.body; // Extract message and chatId from request body
    const userId = req.user.id; // Get authenticated user ID

    // Validate input: message must not be empty
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Send message to AI and get response
    const aiResponse = await sendAIMessage(message, chatId);

    // Check if AI responded successfully
    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI response',
        error: aiResponse.error
      });
    }

    // Log AI interaction in the database
    await prisma.aiLog.create({
      data: {
        userId,
        queryType: 'chatbot',
        prompt: message,
        response: aiResponse.message,
        model: 'GPT-5',
        status: 'success',
        metadata: { chatId: aiResponse.chatId }
      }
    });

    // Return AI response with disclaimer and timestamp
    res.json({
      success: true,
      data: {
        message: aiResponse.message,
        chatId: aiResponse.chatId,
        disclaimer: getLegalDisclaimer(),
        timestamp: aiResponse.timestamp
      }
    });
  } catch (error) {
    next(error); // Pass errors to Express error handler
  }
};


/* =================================================================
    Predict Case Success Probability
   POST /api/ai/predict-case
   Important but used AI in the process
   ================================================================= */
const predictCaseSuccess = async (req, res, next) => {
  try {
    const { caseId, title, description, caseType } = req.body;
    const userId = req.user.id;

    // Fetch existing case details if caseId provided
    let caseDetails;
    if (caseId) {
      const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
      if (!existingCase) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }

      // Authorization checks
      if ((req.user.role === 'client' && existingCase.clientId !== userId) ||
          (req.user.role === 'lawyer' && existingCase.lawyerId !== userId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to access this case' });
      }

      caseDetails = { title: existingCase.title, description: existingCase.description, caseType: existingCase.caseType };
    } else {
      // Use input for new case
      if (!title || !description || !caseType) {
        return res.status(400).json({ success: false, message: 'Case title, description, and type are required' });
      }
      caseDetails = { title, description, caseType };
    }

    // Analyze case probability using AI
    const startTime = Date.now();
    const analysis = await analyzeCaseProbability(caseDetails);
    const responseTime = Date.now() - startTime;

    if (!analysis.success) {
      return res.status(500).json({ success: false, message: 'Failed to analyze case', error: analysis.error });
    }

    // Update case probability in DB if caseId exists
    if (caseId) {
      await prisma.case.update({
        where: { id: caseId },
        data: { probabilityScore: analysis.probability }
      });
    }

    // Log AI analysis
    await prisma.aiLog.create({
      data: {
        userId,
        caseId: caseId || null,
        queryType: 'case_prediction',
        prompt: JSON.stringify(caseDetails),
        response: analysis.analysis,
        model: 'GPT-5',
        confidence: analysis.probability,
        responseTime,
        status: 'success',
        metadata: { chatId: analysis.chatId, probability: analysis.probability }
      }
    });

    // Return analysis and probability
    res.json({
      success: true,
      data: {
        probability: analysis.probability,
        analysis: analysis.analysis,
        chatId: analysis.chatId,
        disclaimer: getLegalDisclaimer(),
        timestamp: analysis.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  chatWithAI,
  predictCaseSuccess,
};
