/* =================================================================
   Handles all AI-related endpoints, including
   chatbot interaction, legal advice, case prediction, document
   analysis, and AI query history.
   ================================================================= */

const { prisma } = require('../config/prisma'); // Import Prisma client for DB queries
const {
  sendAIMessage,       // Function to send messages to AI chatbot
  getLegalAdvice,      // Function to get AI-generated legal advice
  analyzeCaseProbability, // Function to predict case success probability
  analyzeDocument,     // Function to analyze document content
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
    Get Legal Advice from AI
   ================================================================= */
const getAILegalAdvice = async (req, res, next) => {
  try {
    const { query, chatId, caseId } = req.body; // Extract input
    const userId = req.user.id;

    // Validate query input
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Legal query is required'
      });
    }

    // Optional: Check case access if caseId provided
    if (caseId) {
      const caseData = await prisma.case.findUnique({ where: { id: caseId } });
      if (!caseData) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }

      // Authorization: clients/lawyers can only access their own cases
      if ((req.user.role === 'client' && caseData.clientId !== userId) ||
          (req.user.role === 'lawyer' && caseData.lawyerId !== userId)) {
        return res.status(403).json({ success: false, message: 'Not authorized to access this case' });
      }
    }

    // Get AI-generated legal advice
    const aiResponse = await getLegalAdvice(query, chatId);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get legal advice',
        error: aiResponse.error
      });
    }

    // Log AI query to database
    await prisma.aiLog.create({
      data: {
        userId,
        caseId: caseId || null,
        queryType: 'legal_research',
        prompt: query,
        response: aiResponse.message,
        model: 'GPT-5',
        status: 'success',
        metadata: { chatId: aiResponse.chatId }
      }
    });

    // Return AI legal advice with disclaimer
    res.json({
      success: true,
      data: {
        advice: aiResponse.message,
        chatId: aiResponse.chatId,
        disclaimer: getLegalDisclaimer(),
        timestamp: aiResponse.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
};

/* =================================================================
    Predict Case Success Probability
   POST /api/ai/predict-case
   Private access
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

/* =================================================================
   Get AI Conversation History
   GET /api/ai/history
   Private access
   ================================================================= */
const getAIHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { caseId, queryType, limit = 20 } = req.query;

    // Build query filter for Prisma
    const where = { userId };
    if (caseId) where.caseId = caseId;
    if (queryType) where.queryType = queryType;

    const history = await prisma.aiLog.findMany({
      where,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: ['id', 'queryType', 'prompt', 'response', 'confidence', 'createdAt', 'metadata']
    });

    res.json({ success: true, data: { history, count: history.length } });
  } catch (error) {
    next(error);
  }
};

/* =================================================================
    Analyze Document
   POST /api/ai/analyze-document
   Private access
   ================================================================= */
const analyzeDocumentAI = async (req, res, next) => {
  try {
    const { documentSummary, caseId, chatId } = req.body;
    const userId = req.user.id;

    if (!documentSummary || documentSummary.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Document summary is required' });
    }

    // Check case access if caseId provided
    if (caseId) {
      const caseData = await prisma.case.findUnique({ where: { id: caseId } });
      if (!caseData) {
        return res.status(404).json({ success: false, message: 'Case not found' });
      }

      if (req.user.role === 'client' && caseData.clientId !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    // Perform document analysis
    const analysis = await analyzeDocument(documentSummary, chatId);

    if (!analysis.success) {
      return res.status(500).json({ success: false, message: 'Failed to analyze document', error: analysis.error });
    }

    // Log AI document analysis
    await prisma.aiLog.create({
      data: {
        userId,
        caseId: caseId || null,
        queryType: 'document_analysis',
        prompt: documentSummary,
        response: analysis.message,
        model: 'GPT-5',
        status: 'success',
        metadata: { chatId: analysis.chatId }
      }
    });

    res.json({
      success: true,
      data: {
        analysis: analysis.message,
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
  getAILegalAdvice,
  predictCaseSuccess,
  getAIHistory,
  analyzeDocumentAI
};
