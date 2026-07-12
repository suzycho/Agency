// Shared helpers for the CMS API. Files starting with "_" in /api are not
// exposed as endpoints by Vercel.
const crypto = require("crypto");

const SESSION_COOKIE = "cms_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CODE_SLICE_MS = 10 * 60 * 1000; // sign-in codes rotate every 10 minutes

function secret() {
  return process.env.SESSION_SECRET || "";
}

function hmac(data) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

function isAllowed(email) {
  return allowedEmails().includes(normalizeEmail(email));
}

// Sign-in codes are stateless: 6 digits derived from the email and a
// 10-minute time slice, so no database is needed. Verification accepts the
// current and previous slice (a code is valid for 10–20 minutes).
function currentSlice() {
  return Math.floor(Date.now() / CODE_SLICE_MS);
}

function codeFor(email, slice) {
  const digest = crypto
    .createHmac("sha256", secret())
    .update(`code:${normalizeEmail(email)}:${slice}`)
    .digest();
  return String(digest.readUInt32BE(0) % 1000000).padStart(6, "0");
}

function isValidCode(email, code) {
  const slice = currentSlice();
  const candidate = String(code || "").trim();
  return (
    timingSafeEqual(candidate, codeFor(email, slice)) ||
    timingSafeEqual(candidate, codeFor(email, slice - 1))
  );
}

function createSessionToken(email) {
  const payload = `${Buffer.from(normalizeEmail(email)).toString("base64url")}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${hmac(`session:${payload}`)}`;
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || "";
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

// Returns { email } for a valid session, or null. A session dies early if the
// email is removed from ALLOWED_EMAILS.
function readSession(req) {
  if (!secret()) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!timingSafeEqual(parts[2], hmac(`session:${payload}`))) return null;
  if (!(Number(parts[1]) > Date.now())) return null;
  let email;
  try {
    email = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!isAllowed(email)) return null;
  return { email };
}

function sessionCookieHeader(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requireConfig(res) {
  if (!secret()) {
    sendJson(res, 500, { error: "Server is not configured: set the SESSION_SECRET environment variable." });
    return false;
  }
  if (allowedEmails().length === 0) {
    sendJson(res, 500, { error: "Server is not configured: set the ALLOWED_EMAILS environment variable." });
    return false;
  }
  return true;
}

module.exports = {
  normalizeEmail,
  isAllowed,
  codeFor,
  currentSlice,
  isValidCode,
  createSessionToken,
  readSession,
  sessionCookieHeader,
  clearSessionCookieHeader,
  sendJson,
  requireConfig,
};
