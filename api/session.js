// GET — report who is signed in (the editor uses this on load).
// DELETE — sign out.
const { readSession, clearSessionCookieHeader, sendJson } = require("./_lib.js");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const session = readSession(req);
    return sendJson(res, 200, { signedIn: Boolean(session), email: session ? session.email : null });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookieHeader());
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
};
