function requireAuth(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") return next();
  return res.redirect("/admin/login");
}

module.exports = { requireAuth };
