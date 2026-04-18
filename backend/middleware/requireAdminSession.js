module.exports = function requireAdminSession(req, res, next) {
  if (req.session?.adminAuthenticated) {
    return next();
  }

  return res.status(401).json({ error: 'Admin authentication required' });
};
