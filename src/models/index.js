// src/models/index.js
const { sequelize } = require('../config/db');

// Import all models
const User = require('./User')(sequelize);
const Case = require('./Case')(sequelize);
const Message = require('./Message')(sequelize);
const Document = require('./Document')(sequelize);
const AiLogs = require('./AiLogs')(sequelize);
const PasswordReset = require('./PasswordReset')(sequelize);

// ============================================
// Define Relationships
// ============================================

// User <-> Case (One-to-Many: Client has many cases)
User.hasMany(Case, {
  foreignKey: 'clientId',
  as: 'clientCases',
  onDelete: 'CASCADE'
});
Case.belongsTo(User, {
  foreignKey: 'clientId',
  as: 'client'
});

// User <-> Case (One-to-Many: Lawyer handles many cases)
User.hasMany(Case, {
  foreignKey: 'lawyerId',
  as: 'lawyerCases',
  onDelete: 'SET NULL'
});
Case.belongsTo(User, {
  foreignKey: 'lawyerId',
  as: 'lawyer'
});

// User <-> Message (One-to-Many: Sender)
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages',
  onDelete: 'CASCADE'
});
Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

// User <-> Message (One-to-Many: Receiver)
User.hasMany(Message, {
  foreignKey: 'receiverId',
  as: 'receivedMessages',
  onDelete: 'CASCADE'
});
Message.belongsTo(User, {
  foreignKey: 'receiverId',
  as: 'receiver'
});

// Case <-> Message (One-to-Many)
Case.hasMany(Message, {
  foreignKey: 'caseId',
  as: 'messages',
  onDelete: 'CASCADE'
});
Message.belongsTo(Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// Case <-> Document (One-to-Many)
Case.hasMany(Document, {
  foreignKey: 'caseId',
  as: 'documents',
  onDelete: 'CASCADE'
});
Document.belongsTo(Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// User <-> Document (One-to-Many: Uploader)
User.hasMany(Document, {
  foreignKey: 'uploadedBy',
  as: 'uploadedDocuments',
  onDelete: 'CASCADE'
});
Document.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
});

// User <-> Document (One-to-Many: Verifier)
User.hasMany(Document, {
  foreignKey: 'verifiedBy',
  as: 'verifiedDocuments',
  onDelete: 'SET NULL'
});
Document.belongsTo(User, {
  foreignKey: 'verifiedBy',
  as: 'verifier'
});

// User <-> AiLog (One-to-Many)
User.hasMany(AiLogs, {
  foreignKey: 'userId',
  as: 'aiLogs',
  onDelete: 'CASCADE'
});
AiLogs.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Case <-> AiLogs (One-to-Many)
Case.hasMany(AiLogs, {
  foreignKey: 'caseId',
  as: 'aiLogs',
  onDelete: 'SET NULL'
});
AiLogs.belongsTo(Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// User <-> PasswordReset (One-to-Many)
User.hasMany(PasswordReset, {
  foreignKey: 'userId',
  as: 'passwordResets',
  onDelete: 'CASCADE'
});
PasswordReset.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// ============================================
// Export all models
// ============================================

const db = {
  sequelize,
  User,
  Case,
  Message,
  Document,
  AiLogs,
  PasswordReset
};

module.exports = db;