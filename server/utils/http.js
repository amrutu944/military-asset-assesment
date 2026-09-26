class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets route handlers throw instead of repeating try/catch blocks
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// { $gte, $lte } for an optional ?from=YYYY-MM-DD&to=YYYY-MM-DD pair (to is inclusive)
const dateRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

const positiveInt = (value, field = 'Quantity') => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${field} must be a positive whole number`);
  return n;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchRegex = (s) => ({ $regex: escapeRegex(s), $options: 'i' });

module.exports = { HttpError, asyncHandler, dateRange, positiveInt, searchRegex };
