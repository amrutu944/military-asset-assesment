const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const auditLogger = require('./middleware/audit');
const { assignments, expenditures } = require('./routes/assignments');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : '*',
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

// Every state-changing request is written to the audit trail
app.use('/api', auditLogger);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: Math.round(process.uptime()) });
});

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/assets',       require('./routes/assets'));
app.use('/api/purchases',    require('./routes/purchases'));
app.use('/api/transfers',    require('./routes/transfers'));
app.use('/api/assignments',  assignments);
app.use('/api/expenditures', expenditures);
app.use('/api/audit',        require('./routes/audit'));

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Serve the built React app when it exists, so the whole system can run as one service
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({ message: 'Military Asset Management API is running!' }));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 400;
    message = 'Duplicate record';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Something went wrong on the server';
  }
  res.locals.errorMessage = message;
  res.status(status).json({ success: false, message });
});

module.exports = app;
