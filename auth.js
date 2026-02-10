function requireAdmin(req, res, next) {
  const ok = req.cookies && req.cookies.admin === "1";
  if (!ok) return res.redirect("/admin/login");
  next();
}

module.exports = { requireAdmin };
