function requireAuth(req, res, next){
  if(req.session && req.session.user && req.session.user.role === "admin"){
    return next();
  }
  return res.redirect("/login");
}

function requireCustomer(req, res, next){
  if(req.session && req.session.customer && req.session.customer.role === "customer"){
    return next();
  }
  return res.redirect("/customer/login");
}

function requireApiAuth(req, res, next){
  if(req.session && req.session.user && req.session.user.role === "admin"){
    return next();
  }
  return res.status(401).json({ ok:false, error:"unauthorized" });
}

module.exports = { requireAuth, requireApiAuth, requireCustomer };
