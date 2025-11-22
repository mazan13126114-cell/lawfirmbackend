// src/controllers/aiController.js (Prisma Version)
const { prisma } = require('../config/prisma');
const {
  sendAIMessage,
  getLegalAdvice,
  analyzeCaseProbability,
  analyzeDocument,
  getLegalDisclaimer
} = require('../utils/aiService');

// @desc    Chat with AI assistant
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res, next) => {
  try {
    const { message, chatId } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Send message to AI
    const aiResponse = await sendAIMessage(message, chatId);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI response',
        error: aiResponse.error
      });
    }

    // Log the interaction
    await AiLogs.create({
      userId,
      queryType: 'chatbot',
      prompt: message,
      response: aiResponse.message,
      model: 'GPT-5',
      status: 'success',
      metadata: {
        chatId: aiResponse.chatId
      }
    });

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
    next(error);
  }
};

// @desc    Get legal advice from AI
// @route   POST /api/ai/legal-advice
// @access  Private
const getAILegalAdvice = async (req, res, next) => {
  try {
    const { query, chatId, caseId } = req.body;
    const userId = req.user.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Legal query is required'
      });
    }

    // Verify case access if caseId provided
    if (caseId) {
      const caseData = await Case.findByPk(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Check authorization
      if (req.user.role === 'client' && caseData.clientId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this case'
        });
      }

      if (req.user.role === 'lawyer' && caseData.lawyerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this case'
        });
      }
    }

    // Get legal advice from AI
    const aiResponse = await getLegalAdvice(query, chatId);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get legal advice',
        error: aiResponse.error
      });
    }

    // Log the interaction
    await AiLogs.create({
      userId,
      caseId: caseId || null,
      queryType: 'legal_research',
      prompt: query,
      response: aiResponse.message,
      model: 'GPT-5',
      status: 'success',
      metadata: {
        chatId: aiResponse.chatId
      }
    });

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

// @desc    Predict case success probability
// @route   POST /api/ai/predict-case
// @access  Private
const predictCaseSuccess = async (req, res, next) => {
  try {
    const { caseId, title, description, caseType } = req.body;
    const userId = req.user.id;

    // If caseId provided, fetch case details
    let caseDetails;
    if (caseId) {
      const existingCase = await Case.findByPk(caseId);
      
      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Check authorization
      if (req.user.role === 'client' && existingCase.clientId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this case'
        });
      }

      if (req.user.role === 'lawyer' && existingCase.lawyerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this case'
        });
      }

      caseDetails = {
        title: existingCase.title,
        description: existingCase.description,
        caseType: existingCase.caseType
      };
    } else {
      // Use provided details for new case prediction
      if (!title || !description || !caseType) {
        return res.status(400).json({
          success: false,
          message: 'Case title, description, and type are required'
        });
      }

      caseDetails = { title, description, caseType };
    }

    // Analyze case with AI
    const startTime = Date.now();
    const analysis = await analyzeCaseProbability(caseDetails);
    const responseTime = Date.now() - startTime;

    if (!analysis.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze case',
        error: analysis.error
      });
    }

    // Update case with probability if caseId provided
    if (caseId) {
      await Case.update(
        { probabilityScore: analysis.probability },
        { where: { id: caseId } }
      );
    }

    // Log the interaction
    await AiLogs.create({
      userId,
      caseId: caseId || null,
      queryType: 'case_prediction',
      prompt: JSON.stringify(caseDetails),
      response: analysis.analysis,
      model: 'GPT-5',
      confidence: analysis.probability,
      responseTime,
      status: 'success',
      metadata: {
        chatId: analysis.chatId,
        probability: analysis.probability
      }
    });

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

// @desc    Get AI conversation history
// @route   GET /api/ai/history
// @access  Private
const getAIHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { caseId, queryType, limit = 20 } = req.query;

    const where = { userId };
    if (caseId) where.caseId = caseId;
    if (queryType) where.queryType = queryType;

    const history = await AiLogs.findAll({
      where,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'queryType', 'prompt', 'response', 'confidence', 'createdAt', 'metadata']
    });

    res.json({
      success: true,
      data: {
        history,
        count: history.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Analyze document
// @route   POST /api/ai/analyze-document
// @access  Private
const analyzeDocumentAI = async (req, res, next) => {
  try {
    const { documentSummary, caseId, chatId } = req.body;
    const userId = req.user.id;

    if (!documentSummary || documentSummary.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Document summary is required'
      });
    }

    // Verify case access if caseId provided
    if (caseId) {
      const caseData = await Case.findByPk(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      if (req.user.role === 'client' && caseData.clientId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized'
        });
      }
    }

    // Analyze document
    const analysis = await analyzeDocument(documentSummary, chatId);

    if (!analysis.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze document',
        error: analysis.error
      });
    }

    // Log the interaction
    await AiLogs.create({
      userId,
      caseId: caseId || null,
      queryType: 'document_analysis',
      prompt: documentSummary,
      response: analysis.message,
      model: 'GPT-5',
      status: 'success',
      metadata: {
        chatId: analysis.chatId
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