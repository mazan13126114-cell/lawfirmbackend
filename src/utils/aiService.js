// src/utils/aiService.js
require('dotenv').config();
const axios = require('axios');

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = 'gpt-4.1-mini'; // cost + quality balance

// =======================
// Utility Functions
// =======================

/**
 * Generate a unique chat ID for a new conversation
 * @returns {string}
 */
const generateChatId = () => {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Provide legal disclaimer text
 * @returns {string}
 */
const getLegalDisclaimer = () => {
  return 'Legal Disclaimer: This AI-generated response is for informational purposes only and does not constitute legal advice. Please consult with a licensed attorney for specific legal matters concerning your case.';
};

/**
 * Normalize AI response to ensure it is safe to store in DB
 * @param {Object} aiResponse
 * @returns {Object}
 */
const normalizeAIResponse = (aiResponse) => {
  const clone = { ...aiResponse };

  if (clone.analysis && typeof clone.analysis !== 'string') {
    clone.analysis = JSON.stringify(clone.analysis);
  }

  if (clone.message && typeof clone.message !== 'string') {
    clone.message = JSON.stringify(clone.message);
  }

  if (clone.probability !== undefined) {
    clone.probability = Number(clone.probability) || 0;
  }

  return clone;
};

// =======================
// AI Communication Functions
// =======================

/**
 * Send a message to OpenAI
 * @param {string} message
 * @param {string|null} chatId
 * @returns {Promise<Object>}
 */
const sendAIMessage = async (message, chatId = null) => {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: OPENAI_MODEL,
        input: message
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const outputText =
      response.data.output_text ||
      response.data.output?.[0]?.content?.[0]?.text ||
      'No response from AI';

    return {
      success: true,
      message: outputText,
      chatId: chatId || generateChatId(),
      model: response.data.model || OPENAI_MODEL,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);

    return {
      success: false,
      message: 'Sorry, I am unable to process your request at the moment. Please try again.',
      error: error.message,
      timestamp: new Date()
    };
  }
};

// =======================
// Legal AI Functions
// =======================

/**
 * Get legal advice from AI
 * @param {string} query
 * @param {string|null} chatId
 * @returns {Promise<Object>}
 */
const getLegalAdvice = async (query, chatId = null) => {
  const legalPrompt = `
You are a legal AI assistant for LawConnect.

Provide accurate, high-level legal information.
Do NOT provide definitive legal advice.
ALWAYS remind the user to consult a licensed attorney.

User query:
${query}
`;

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

  const prompt = `
You are a legal AI analyst.

Analyze the following case and provide:
1. Success probability (0–100%)
2. Key strengths
3. Potential challenges
4. Recommended actions

Case Type: ${caseType}
Title: ${title}
Description: ${description}

Include exactly one percentage value.
`;

  const response = await sendAIMessage(prompt);

  if (response.success) {
    const analysisStr = response.message;
    const probabilityMatch = analysisStr.match(/(\d+)%/);
    const probability = probabilityMatch ? parseInt(probabilityMatch[1], 10) : 50;

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

// =======================
// Exports
// =======================

module.exports = {
  sendAIMessage,
  getLegalAdvice,
  analyzeCaseProbability,
  generateChatId,
  getLegalDisclaimer
};
