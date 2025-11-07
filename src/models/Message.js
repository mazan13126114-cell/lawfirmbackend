// src/models/Message.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sender_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'receiver_id',
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
      onDelete: 'CASCADE',
      comment: 'Optional: Link message to a specific case'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Message cannot be empty'
        },
        len: {
          args: [1, 5000],
          msg: 'Message must be between 1 and 5000 characters'
        }
      }
    },
    messageType: {
      type: DataTypes.ENUM('text', 'file', 'notification', 'system'),
      allowNull: false,
      defaultValue: 'text',
      field: 'message_type'
    },
    attachmentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'attachment_url',
      comment: 'URL to attached file if messageType is file'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_deleted',
      comment: 'Soft delete flag'
    },
    deletedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'deleted_by',
      comment: 'User ID who deleted the message'
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    underscored: true,
    hooks: {
      // Set readAt timestamp when isRead changes to true
      beforeUpdate: async (message) => {
        if (message.changed('isRead') && message.isRead && !message.readAt) {
          message.readAt = new Date();
        }
      }
    },
    indexes: [
      {
        fields: ['sender_id', 'receiver_id']
      },
      {
        fields: ['case_id']
      },
      {
        fields: ['is_read']
      }
    ]
  });

  // Instance method to mark as read
  Message.prototype.markAsRead = async function() {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  };

  return Message;
};