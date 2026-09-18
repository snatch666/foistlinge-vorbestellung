function basicAuth(req, res, next) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASS || "";

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const sepIndex = decoded.indexOf(":");
    const reqUser = decoded.slice(0, sepIndex);
    const reqPass = decoded.slice(sepIndex + 1);
    if (reqUser === user && reqPass === pass) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Admin", charset="UTF-8"');
  return res.status(401).send("Zugriff verweigert.");
}

module.exports = { basicAuth };
