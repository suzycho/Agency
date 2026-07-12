// POST { email } — if the email is on the allowlist, generate a 6-digit
// sign-in code and email it via Resend. Responds identically for unknown
// emails so the endpoint doesn't reveal who is on the allowlist.
const {
  normalizeEmail,
  isAllowed,
  codeFor,
  currentSlice,
  sendJson,
  requireConfig,
} = require("./_lib.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  if (!requireConfig(res)) return;

  const email = normalizeEmail(req.body && req.body.email);
  if (!email || !email.includes("@")) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  if (isAllowed(email)) {
    const code = codeFor(email, currentSlice());
    if (emailConfigured) {
      const sent = await sendCodeEmail(email, code);
      if (!sent) {
        return sendJson(res, 502, { error: "Could not send the sign-in email. Try again in a minute." });
      }
    } else {
      // No email provider configured yet — surface the code in the server
      // logs so the site owner can test the flow before wiring up Resend.
      console.log(`[cms] sign-in code for ${email}: ${code}`);
    }
  }

  return sendJson(res, 200, {
    ok: true,
    message: "If that address is approved, a sign-in code is on its way. It expires in about 10 minutes.",
    emailConfigured,
  });
};

async function sendCodeEmail(to, code) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Skeptical CMS <onboarding@resend.dev>",
        to: [to],
        subject: `${code} is your sign-in code`,
        text: [
          `Your sign-in code for the Skeptical site editor is: ${code}`,
          "",
          "It expires in about 10 minutes. If you didn't request this, you can ignore this email.",
        ].join("\n"),
      }),
    });
    if (!response.ok) {
      console.error(`[cms] Resend error ${response.status}: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cms] Resend request failed:", err);
    return false;
  }
}
