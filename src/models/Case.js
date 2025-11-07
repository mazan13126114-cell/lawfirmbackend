// src/models/Case.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Case = sequelize.define('Case', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'client_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    lawyerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'lawyer_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    caseNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'case_number',
      comment: 'Auto-generated unique case identifier'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Case title is required'
        },
        len: {
          args: [5, 255],
          msg: 'Title must be between 5 and 255 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Case description is required'
        },
        len: {
          args: [20],
          msg: 'Description must be at least 20 characters'
        }
      }
    },
    caseType: {
      type: DataTypes.ENUM('civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other'),
      allowNull: false,
      field: 'case_type',
      defaultValue: 'civil',
      validate: {
        isIn: {
          args: [['civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other']],
          msg: 'Invalid case type'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'assigned', 'ongoing', 'review', 'closed', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'assigned', 'ongoing', 'review', 'closed', 'rejected']],
          msg: 'Invalid status'
        }
      }
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
      validate: {
        isIn: {
          args: [['low', 'medium', 'high', 'urgent']],
          msg: 'Invalid priority level'
        }
      }
    },
    probabilityScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'probability_score',
      comment: 'AI-predicted success probability (0-100)',
      validate: {
        min: 0,
        max: 100
      }
    },
    estimatedDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'estimated_duration',
      comment: 'Estimated duration in days'
    },
    actualDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'actual_duration',
      comment: 'Actual duration in days'
    },
    filingDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'filing_date'
    },
    closingDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closing_date'
    },
    courtName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'court_name'
    },
    caseOutcome: {
      type: DataTypes.ENUM('won', 'lost', 'settled', 'dismissed', 'pending'),
      allowNull: true,
      field: 'case_outcome',
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Internal notes for lawyers'
    }
  }, {
    tableName: 'cases',
    timestamps: true,
    underscored: true,
    hooks: {
      // Generate case number before creating
      beforeCreate: async (caseInstance) => {
        if (!caseInstance.caseNumber) {
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000);
          caseInstance.caseNumber = `CASE-${timestamp}-${random}`;
        }
      },
      // Update actual duration when case is closed
      beforeUpdate: async (caseInstance) => {
        if (caseInstance.changed('status') && caseInstance.status === 'closed') {
          if (!caseInstance.closingDate) {
            caseInstance.closingDate = new Date();
          }
          if (caseInstance.createdAt && caseInstance.closingDate) {
            const diffTime = Math.abs(caseInstance.closingDate - caseInstance.createdAt);
            caseInstance.actualDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
      }
    }
  });

  return Case;
};