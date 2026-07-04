module.exports = function requireUserOrAdmin(req, res, next) {
  if ((req.isAuthenticated && req.isAuthenticated()) || req.session?.adminAuthenticated) {
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
};
