// src/controllers/aiController.js
const { AiLogs, Case } = require('../models');
const {
  sendAIMessage,
  getLegalAdvice,
  analyzeCaseProbability,
  analyzeDocument,
  getLegalDisclaimer
} = require('../utils/aiService');

// --- Helper to safely stringify prompt ---
const ensureString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

// @desc Chat with AI
const chatWithAI = async (req, res, next) => {
  try {
    const { message, chatId } = req.body;
    const userId = req.user.id;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const aiResponse = await sendAIMessage(message, chatId);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI response',
        error: aiResponse.error?.toString() || 'Unknown error'
      });
    }

    await AiLogs.create({
      userId,
      queryType: 'chatbot',
      prompt: ensureString(message),
      response: ensureString(aiResponse),
      model: 'GPT-5',
      status: 'success',
      metadata: { chatId: aiResponse.chatId }
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

// @desc Get legal advice from AI
const getAILegalAdvice = async (req, res, next) => {
  try {
    const { query, chatId, caseId } = req.body;
    const userId = req.user.id;

    if (!query?.trim()) {
      return res.status(400).json({ success: false, message: 'Legal query is required' });
    }

    let safeCaseId = 0;
    if (caseId !== undefined && caseId !== null && caseId !== '') {
      const parsedId = Number(caseId);
      if (!isNaN(parsedId)) safeCaseId = parsedId;
    }

    let caseData = null;
    if (safeCaseId > 0) {
      caseData = await Case.findByPk(safeCaseId);
      if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

      if (
        (req.user.role === 'client' && caseData.clientId !== userId) ||
        (req.user.role === 'lawyer' && caseData.lawyerId !== userId)
      ) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const aiResponse = await getLegalAdvice(query, chatId);

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get legal advice',
        error: aiResponse.error?.toString() || 'Unknown error'
      });
    }

    await AiLogs.create({
      userId,
      caseId: safeCaseId,
      queryType: 'legal_research',
      prompt: ensureString(query),
      response: ensureString(aiResponse),
      model: 'GPT-5',
      status: 'success',
      metadata: { chatId: aiResponse.chatId }
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

// @desc Predict case success
const predictCaseSuccess = async (req, res, next) => {
  try {
    const { caseId, title, description, caseType } = req.body;
    const userId = req.user.id;
    let caseDetails;

    if (caseId) {
      const existingCase = await Case.findByPk(caseId);
      if (!existingCase) return res.status(404).json({ success: false, message: 'Case not found' });

      if (
        (req.user.role === 'client' && existingCase.clientId !== userId) ||
        (req.user.role === 'lawyer' && existingCase.lawyerId !== userId)
      ) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      caseDetails = {
        title: existingCase.title,
        description: existingCase.description,
        caseType: existingCase.caseType
      };
    } else {
      if (!title || !description || !caseType) {
        return res.status(400).json({ success: false, message: 'Case title, description, and type required' });
      }
      caseDetails = { title, description, caseType };
    }

    const start = Date.now();
    const analysis = await analyzeCaseProbability(caseDetails);
    const duration = Date.now() - start;

    if (!analysis.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze case',
        error: analysis.error?.toString() || 'Unknown error'
      });
    }

    if (caseId) {
      await Case.update({ probabilityScore: analysis.probability }, { where: { id: caseId } });
    }

    await AiLogs.create({
      userId,
      caseId: caseId || null,
      queryType: 'case_prediction',
      prompt: ensureString(caseDetails),
      response: ensureString(analysis),
      model: 'GPT-5',
      confidence: analysis.probability,
      responseTime: duration,
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

// @desc Get AI history
const getAIHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { caseId, queryType, limit = 20 } = req.query;

    const where = { userId };
    if (caseId) where.caseId = Number(caseId);
    if (queryType) where.queryType = queryType;

    const history = await AiLogs.findAll({
      where,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'queryType', 'prompt', 'response', 'confidence', 'createdAt', 'metadata']
    });

    res.json({
      success: true,
      data: { history, count: history.length }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Analyze document
const analyzeDocumentAI = async (req, res, next) => {
  try {
    const { documentSummary, caseId, chatId } = req.body;
    const userId = req.user.id;

    if (!documentSummary?.trim()) {
      return res.status(400).json({ success: false, message: 'Document summary required' });
    }

    if (caseId) {
      const caseData = await Case.findByPk(caseId);
      if (!caseData) return res.status(404).json({ success: false, message: 'Case not found' });

      if (req.user.role === 'client' && caseData.clientId !== userId)
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const analysis = await analyzeDocument(documentSummary, chatId);

    if (!analysis.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze document',
        error: analysis.error?.toString() || 'Unknown error'
      });
    }

    await AiLogs.create({
      userId,
      caseId: caseId || null,
      queryType: 'document_analysis',
      prompt: ensureString(documentSummary),
      response: ensureString(analysis),
      model: 'GPT-5',
      status: 'success',
      metadata: { chatId: analysis.chatId }
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
