// POST { email, code } — verify a sign-in code and set the session cookie.
const {
  normalizeEmail,
  isAllowed,
  isValidCode,
  currentSlice,
  createSessionToken,
  sessionCookieHeader,
  sendJson,
  requireConfig,
} = require("./_lib.js");

// Best-effort brute-force throttle. In-memory, so it resets on cold starts,
// but it still caps guessing within a warm instance.
const attempts = new Map();
const MAX_ATTEMPTS_PER_SLICE = 8;

function tooManyAttempts(email) {
  const slice = currentSlice();
  const entry = attempts.get(email);
  if (!entry || entry.slice !== slice) {
    attempts.set(email, { slice, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS_PER_SLICE;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (!requireConfig(res)) return;

  const email = normalizeEmail(req.body && req.body.email);
  const code = String((req.body && req.body.code) || "").trim();

  if (!email || !code) {
    return sendJson(res, 400, { error: "Email and code are required." });
  }
  if (tooManyAttempts(email)) {
    return sendJson(res, 429, { error: "Too many attempts. Request a new code in a few minutes." });
  }
  if (!isAllowed(email) || !isValidCode(email, code)) {
    return sendJson(res, 401, { error: "That code didn't match. Check it or request a new one." });
  }

  res.setHeader("Set-Cookie", sessionCookieHeader(createSessionToken(email)));
  return sendJson(res, 200, { ok: true, email });
};
