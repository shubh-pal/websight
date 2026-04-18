module.exports = function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
};
