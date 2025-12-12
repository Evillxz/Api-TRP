module.exports = function requireApiKey(req, res, next) {
  const key = process.env.API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const provided = req.header('x-api-key') || req.query.api_key;
  if (!provided || provided !== key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
