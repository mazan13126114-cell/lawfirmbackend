// src/models/PasswordReset.js
const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const PasswordReset = sequelize.define('PasswordReset', {
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
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Token is required'
        }
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      validate: {
        isDate: true
      }
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_used',
      comment: 'Mark token as used after password reset'
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
      comment: 'IP address from which reset was requested'
    },
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'user_agent',
      comment: 'Browser/device info'
    }
  }, {
    tableName: 'password_resets',
    timestamps: true,
    underscored: true,
    hooks: {
      // Generate token and expiry before creating
      beforeCreate: async (passwordReset) => {
        if (!passwordReset.token) {
          passwordReset.token = crypto.randomBytes(32).toString('hex');
        }
        if (!passwordReset.expiresAt) {
          // Token expires in 1 hour
          passwordReset.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        }
      },
      // Set usedAt when marking as used
      beforeUpdate: async (passwordReset) => {
        if (passwordReset.changed('isUsed') && passwordReset.isUsed && !passwordReset.usedAt) {
          passwordReset.usedAt = new Date();
        }
      }
    },
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['token']
      },
      {
        fields: ['expires_at']
      }
    ]
  });

  // Check if token is valid
  PasswordReset.prototype.isValid = function() {
    return !this.isUsed && new Date() < this.expiresAt;
  };

  // Mark token as used
  PasswordReset.prototype.markAsUsed = async function() {
    this.isUsed = true;
    this.usedAt = new Date();
    await this.save();
  };

  // Static method to clean up expired tokens
  PasswordReset.cleanExpired = async function() {
    const deleted = await this.destroy({
      where: {
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
    return deleted;
  };

  return PasswordReset;
};