// src/models/Document.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    caseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'case_id',
      references: {
        model: 'cases',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'uploaded_by',
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Filename is required'
        }
      }
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'original_name',
      comment: 'Original filename before upload'
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_path',
      comment: 'Server path or cloud storage URL'
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size',
      comment: 'File size in bytes'
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'mime_type',
      comment: 'File MIME type (e.g., application/pdf)'
    },
    documentType: {
      type: DataTypes.ENUM('evidence', 'contract', 'statement', 'court_order', 'identification', 'other'),
      allowNull: false,
      field: 'document_type',
      defaultValue: 'other'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified',
      comment: 'Verified by lawyer/admin'
    },
    verifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    }
  }, {
    tableName: 'documents',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['case_id']
      },
      {
        fields: ['uploaded_by']
      },
      {
        fields: ['document_type']
      }
    ]
  });

  // Instance method to verify document
  Document.prototype.verify = async function(verifierId) {
    this.isVerified = true;
    this.verifiedBy = verifierId;
    this.verifiedAt = new Date();
    await this.save();
  };

  return Document;
};