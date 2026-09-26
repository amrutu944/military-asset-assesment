const AuditLog = require('../models/AuditLog');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REDACTED = new Set(['password', 'token', 'newPassword']);

const sanitize = (body) => {
  if (!body || typeof body !== 'object') return undefined;
  const clean = {};
  for (const [key, value] of Object.entries(body)) {
    clean[key] = REDACTED.has(key) ? '[REDACTED]' : value;
  }
  return clean;
};

// Writes one AuditLog row for every state-changing API call once the response
// has been sent, whether it succeeded or was rejected (401/403/400 attempts are
// just as important for an audit trail). Route handlers can enrich the entry by
// setting res.locals.audit = { action, entity, entityId, summary, user }.
const auditLogger = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next();

  const startedAt = Date.now();
  res.on('finish', () => {
    const extra = res.locals.audit || {};
    const actor = req.user || extra.user || null;

    AuditLog.create({
      user:       actor?._id || null,
      userName:   actor?.name || req.body?.email || 'anonymous',
      role:       actor?.role || null,
      base:       extra.base || actor?.base || null,
      action:     extra.action || `${req.method} ${req.baseUrl}${req.route?.path || ''}`,
      entity:     extra.entity || null,
      entityId:   extra.entityId ? String(extra.entityId) : null,
      summary:    extra.summary || res.locals.errorMessage || '',
      method:     req.method,
      path:       req.originalUrl,
      statusCode: res.statusCode,
      success:    res.statusCode < 400,
      ip:         req.ip,
      userAgent:  req.get('user-agent'),
      durationMs: Date.now() - startedAt,
      payload:    sanitize(req.body),
    }).catch((err) => console.error('Audit log write failed:', err.message));
  });

  next();
};

module.exports = auditLogger;
