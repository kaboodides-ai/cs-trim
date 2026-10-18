// Emails desktop download links to visitors who arrive on a phone (via Resend).
// Needs RESEND_API_KEY in Vercel env and cstrim.site verified as a sending domain in Resend.

const SITE = "https://cstrim.site";
const FROM = process.env.RESEND_FROM || "CS Trim <hello@cstrim.site>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "";

// In-memory rate limiting (per warm instance): IP -> timestamps, email -> timestamps
const ipHits = new Map();
const emailHits = new Map();

function isLimited(map, key, windowMs, max) {
    if (!key) return false;
    const now = Date.now();
    const recent = (map.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) return true;
    recent.push(now);
    map.set(key, recent);
    if (map.size > 2000) map.clear();
    return false;
}

function buildEmail() {
    const win = `${SITE}/download/CS-Trim-Setup.exe`;
    const mac = `${SITE}/download/CS-Trim-v1.0.0-Mac.pkg`;
    const guide = `${SITE}/install-guide?utm_source=email&utm_medium=download_link`;

    const button = (href, label, primary) =>
        `<a href="${href}" style="display:inline-block;margin:0 0 10px 0;padding:13px 22px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;${primary ? "background:#2f7cf6;color:#ffffff;" : "background:#f1f1f3;color:#111111;"}">${label}</a>`;

    const html = `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:0;background:#f6f6f7;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;color:#111111;">
    <div style="background:#ffffff;border:1px solid #e6e6e9;border-radius:14px;padding:32px 28px;">
      <p style="margin:0 0 6px 0;font-size:13px;color:#6e6e76;">CS Trim לפרמייר פרו</p>
      <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;">הקישור להורדה, כמו שביקשת</h1>
      <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3a3a40;">
        פתחו את המייל הזה במחשב ובחרו את הגרסה שמתאימה לכם. ההתקנה לוקחת פחות מדקה, והתוסף חינמי לגמרי.
      </p>
      ${button(win, "הורדה ל-Windows", true)}<br>
      ${button(mac, "הורדה ל-Mac", false)}
      <p style="margin:20px 0 0 0;font-size:14px;line-height:1.6;color:#3a3a40;">
        אחרי ההתקנה: ב-Premiere Pro פותחים <span dir="ltr">Window › Extensions › CS Trim</span>.
        נתקעתם? <a href="${guide}" style="color:#2f7cf6;">מדריך ההתקנה המצולם</a>.
      </p>
    </div>
    <p style="margin:16px 4px 0 4px;font-size:12px;line-height:1.5;color:#8a8a92;">
      קיבלת את המייל כי ביקשת קישור הורדה באתר cstrim.site. אם זה לא היית את/ה, אפשר להתעלם.
    </p>
  </div>
</body>
</html>`;

    const text = [
        "הקישור להורדה של CS Trim, כמו שביקשת.",
        "פתחו את המייל במחשב ובחרו גרסה:",
        `Windows: ${win}`,
        `Mac: ${mac}`,
        "",
        `מדריך התקנה: ${guide}`
    ].join("\n");

    return { html, text };
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", SITE);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email, website_trap } = req.body || {};
    if (website_trap) return res.status(200).json({ ok: true });

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || cleanEmail.length > 254) {
        return res.status(400).json({ ok: false, message: "כתובת האימייל אינה תקינה" });
    }

    const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim();
    if (isLimited(ipHits, ip, 10 * 60 * 1000, 5) || isLimited(emailHits, cleanEmail, 60 * 60 * 1000, 2)) {
        return res.status(429).json({ ok: false, message: "כבר שלחנו קישור לכתובת הזו. בדקו גם בתיקיית הספאם." });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error("send-download-link: RESEND_API_KEY is not set");
        return res.status(500).json({ ok: false, message: "שליחת מיילים עדיין לא מוגדרת" });
    }

    const { html, text } = buildEmail();
    const payload = {
        from: FROM,
        to: [cleanEmail],
        subject: "קישור ההורדה של CS Trim למחשב",
        html,
        text
    };
    if (REPLY_TO) payload.reply_to = REPLY_TO;

    try {
        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!r.ok) {
            console.error("send-download-link: Resend error", r.status, await r.text().catch(() => ""));
            return res.status(502).json({ ok: false, message: "לא הצלחנו לשלוח את המייל כרגע" });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("send-download-link: request failed", err);
        return res.status(502).json({ ok: false, message: "לא הצלחנו לשלוח את המייל כרגע" });
    }
}
