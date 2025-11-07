// src/models/AiLog.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiLogs = sequelize.define('AiLogs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    caseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'case_id',
      references: {
        model: 'cases',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Optional: Associate AI query with a case'
    },
    queryType: {
      type: DataTypes.ENUM('chatbot', 'case_prediction', 'document_analysis', 'legal_research'),
      allowNull: false,
      field: 'query_type',
      defaultValue: 'chatbot'
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Prompt cannot be empty'
        }
      },
      comment: 'User input/question sent to AI'
    },
    response: {
  type: DataTypes.JSON,
  allowNull: false,
  comment: 'AI-generated response'
  },

    model: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'gpt-4',
      comment: 'AI model used (e.g., gpt-4, gpt-3.5-turbo)'
    },
    tokensUsed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'tokens_used',
      comment: 'Number of tokens consumed in API call'
    },
    responseTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'response_time',
      comment: 'API response time in milliseconds'
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'AI confidence score (0-100) for predictions',
      validate: {
        min: 0,
        max: 100
      }
    },
    status: {
      type: DataTypes.ENUM('success', 'error', 'timeout'),
      allowNull: false,
      defaultValue: 'success'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
      comment: 'Error details if status is error'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional data like parameters, context, etc.'
    }
  }, {
    tableName: 'ai_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['case_id']
      },
      {
        fields: ['query_type']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return AiLogs;
};