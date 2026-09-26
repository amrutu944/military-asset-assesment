const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName:   { type: String, default: 'anonymous' },
    role:       { type: String, default: null },
    base:       { type: String, default: null },
    action:     { type: String, required: true, index: true },
    entity:     { type: String, default: null },
    entityId:   { type: String, default: null },
    summary:    { type: String, default: '' },
    method:     { type: String },
    path:       { type: String },
    statusCode: { type: Number },
    success:    { type: Boolean },
    ip:         { type: String },
    userAgent:  { type: String },
    durationMs: { type: Number },
    payload:    { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ base: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
