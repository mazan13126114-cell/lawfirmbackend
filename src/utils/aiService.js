// src/utils/aiService.js
const axios = require('axios');

const AI_API_BASE = 'https://batgpt.vercel.app/api/gpt';

/**
 * Generate unique chat ID for new conversation
 * @returns {string}
 */
const generateChatId = () => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Legal disclaimer text
 * @returns {string}
 */
const getLegalDisclaimer = () => {
  return "⚠️ **Legal Disclaimer**: This AI-generated response is for informational purposes only and does not constitute legal advice. Please consult with a licensed attorney for specific legal matters concerning your case.";
};

/**
 * Normalize AI response to ensure DB-safe data
 * @param {Object} aiResponse
 * @returns {Object}
 */
const normalizeAIResponse = (aiResponse) => {
  const clone = { ...aiResponse };

  // Ensure analysis/message is string
  if (clone.analysis && typeof clone.analysis !== 'string') {
    clone.analysis = JSON.stringify(clone.analysis);
  }

  if (clone.message && typeof clone.message !== 'string') {
    clone.message = JSON.stringify(clone.message);
  }

  // Ensure probability is number
  if (clone.probability !== undefined) {
    clone.probability = Number(clone.probability) || 0;
  }

  return clone;
};

/**
 * Send message to AI chatbot
 * @param {string} message
 * @param {string|null} chatId
 * @returns {Promise<Object>} AI response
 */
const sendAIMessage = async (message, chatId = null) => {
  try {
    const params = { message };
    if (chatId) params.chatid = chatId;

    const response = await axios.get(AI_API_BASE, { params, timeout: 30000 });

    // Determine raw message
    const rawMessage = response.data.message || response.data.response || response.data;

    // Force string for DB safety
    const messageStr = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);

    return {
      success: true,
      message: messageStr,
      chatId: response.data.chatId || chatId || generateChatId(),
      model: 'GPT-5',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('AI Service Error:', error.message);

    return {
      success: false,
      message: 'Sorry, I am unable to process your request at the moment. Please try again.',
      error: error.message,
      timestamp: new Date()
    };
  }
};

/**
 * Get legal advice from AI
 * @param {string} query
 * @param {string|null} chatId
 * @returns {Promise<Object>}
 */
const getLegalAdvice = async (query, chatId = null) => {
  const legalPrompt = `As a legal AI assistant for LawConnect, provide professional legal guidance for the following query. Be informative, accurate, and helpful, but remind the user to consult with a licensed attorney for specific legal advice:\n\n${query}`;
  
  const response = await sendAIMessage(legalPrompt, chatId);
  return normalizeAIResponse(response);
};

/**
 * Analyze case details and predict success probability
 * @param {Object} caseDetails
 * @returns {Promise<Object>}
 */
const analyzeCaseProbability = async (caseDetails) => {
  const { title, description, caseType } = caseDetails;

  const prompt = `As a legal AI analyst, analyze this case and provide:
1. A success probability percentage (0-100)
2. Key strengths of the case
3. Potential challenges
4. Recommended actions

Case Type: ${caseType}
Title: ${title}
Description: ${description}

Provide the probability as a number between 0-100, followed by detailed analysis.`;

  const response = await sendAIMessage(prompt);

  if (response.success) {
    // Force string for analysis
    let analysisStr = typeof response.message === 'string' ? response.message : JSON.stringify(response.message);

    // Extract probability from text (fallback to 50)
    const probabilityMatch = analysisStr.match(/(\d+)%/);
    const probability = probabilityMatch ? parseInt(probabilityMatch[1]) : 50;

    return normalizeAIResponse({
      success: true,
      probability: Math.min(Math.max(probability, 0), 100),
      analysis: analysisStr,
      chatId: response.chatId,
      timestamp: response.timestamp
    });
  }

  return normalizeAIResponse(response);
};

/**
 * Analyze document summary
 * @param {string} documentSummary
 * @param {string|null} chatId
 * @returns {Promise<Object>}
 */
const analyzeDocument = async (documentSummary, chatId = null) => {
  const prompt = `As a legal document analyst, review this document summary and provide:
1. Key legal points
2. Potential risks or issues
3. Recommendations

Document Summary: ${documentSummary}`;
  
  const response = await sendAIMessage(prompt, chatId);
  return normalizeAIResponse(response);
};

module.exports = {
  sendAIMessage,
  getLegalAdvice,
  analyzeCaseProbability,
  analyzeDocument,
  generateChatId,
  getLegalDisclaimer
};
