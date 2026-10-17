// In-memory rate limiting map (IP -> timestamps array)
const rateLimitMap = new Map();

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 15; // max 15 requests per 5 minutes

    const timestamps = rateLimitMap.get(ip) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
        return true;
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);

    if (rateLimitMap.size > 1000) {
        for (const [key, times] of rateLimitMap.entries()) {
            if (times.every(t => now - t >= windowMs)) {
                rateLimitMap.delete(key);
            }
        }
    }
    return false;
}

export default async function handler(req, res) {
    // CORS headers for requests from Premiere Pro CEP plugin or website
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const clientIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "";
        
        if (isRateLimited(clientIp)) {
            return res.status(429).json({
                error: "שלחת מספר בקשות ברצף. אנא המתן דקה ונסה שוב."
            });
        }

        const { type, message, contact, source, platform, version, website_trap } = req.body || {};

        // Honeypot check (anti-bot trap)
        if (website_trap) {
            return res.status(200).json({
                success: true,
                message: "הפידבק התקבל בהצלחה!"
            });
        }

        const cleanMessage = (message || "").trim();
        if (!cleanMessage || cleanMessage.length < 3) {
            return res.status(400).json({ error: "נא לכתוב פידבק או תיאור של לפחות מספר מילים" });
        }

        if (cleanMessage.length > 2500) {
            return res.status(400).json({ error: "הפידבק ארוך מדי (מקסימום 2500 תווים)" });
        }

        const cleanType = (type || "improvement").trim(); // "improvement", "bug", "general"
        const cleanContact = (contact || "").trim().slice(0, 150);
        const cleanSource = (source || "website").trim().slice(0, 50); // "plugin" or "website"
        const cleanPlatform = (platform || "Unknown").trim().slice(0, 80);
        const cleanVersion = (version || "1.0.5").trim().slice(0, 30);

        const typeLabels = {
            improvement: "💡 הצעת שיפור / פיצ'ר",
            bug: "🐛 דיווח על באג / תקלה",
            general: "⭐ פידבק כללי / חוות דעת"
        };
        const typeLabel = typeLabels[cleanType] || cleanType;

        const newFeedback = {
            id: "fb_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            dateFormatted: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
            type: cleanType,
            typeLabel: typeLabel,
            message: cleanMessage,
            contact: cleanContact || "לא צוין",
            source: cleanSource,
            platform: cleanPlatform,
            version: cleanVersion
        };

        // 1. Try to save to website/feedbacks.json on GitHub repository
        const tokenCandidates = [
            process.env.github_token,
            process.env.GITHUB_TOKEN,
            process.env.GH_TOKEN,
            process.env.gh_token,
            process.env.GIT_TOKEN,
            process.env.GITHUB_PAT,
            process.env.GITHUB_ACCESS_TOKEN,
            process.env.PERSONAL_ACCESS_TOKEN,
            process.env.PAT,
            process.env.TOKEN
        ];
        const caseInsensitiveKey = Object.keys(process.env).find(k => 
            ["github_token", "gh_token", "git_token", "github_pat", "token"].includes(k.toLowerCase())
        );
        const token = (tokenCandidates.find(t => typeof t === "string" && t.trim().length > 0) || (caseInsensitiveKey ? process.env[caseInsensitiveKey] : "") || "").trim();
        const repo = (process.env.GITHUB_REPO || process.env.github_repo || "kaboodides-ai/cs-trim").trim();
        const filePath = "website/feedbacks.json";

        let savedToGitHub = false;
        if (token) {
            try {
                const getUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
                const getRes = await fetch(getUrl, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "cs-trim-feedback"
                    }
                });

                let sha = null;
                let feedbacksData = { feedbacks: [], lastUpdated: "" };

                if (getRes.ok) {
                    const fileData = await getRes.json();
                    sha = fileData.sha;
                    const existingContent = Buffer.from(fileData.content, "base64").toString("utf8");
                    try {
                        feedbacksData = JSON.parse(existingContent);
                    } catch (e) {}
                }

                if (!Array.isArray(feedbacksData.feedbacks)) {
                    feedbacksData.feedbacks = [];
                }

                // Add newest feedback at top of array
                feedbacksData.feedbacks.unshift(newFeedback);
                feedbacksData.lastUpdated = new Date().toISOString().split("T")[0];

                const updatedContentBase64 = Buffer.from(JSON.stringify(feedbacksData, null, 2), "utf8").toString("base64");

                const putPayload = {
                    message: `New feedback [${cleanType}]: ${cleanMessage.slice(0, 45).replace(/\n/g, " ")}`,
                    content: updatedContentBase64,
                    branch: "main"
                };
                if (sha) putPayload.sha = sha;

                const putRes = await fetch(getUrl, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Accept": "application/vnd.github.v3+json",
                        "Content-Type": "application/json",
                        "User-Agent": "cs-trim-feedback"
                    },
                    body: JSON.stringify(putPayload)
                });

                if (putRes.ok) {
                    savedToGitHub = true;
                } else {
                    console.warn("GitHub feedback commit note:", await putRes.text());
                }
            } catch (ghErr) {
                console.warn("GitHub feedback commit error:", ghErr.message);
            }
        } else {
            console.log(`[Feedback Logged Locally] [${cleanType}] "${cleanMessage}" (Contact: ${cleanContact || 'none'})`);
        }

        // 2. Dispatch to Webhook / Google Sheets if configured
        const webhookUrl = (process.env.FEEDBACK_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
        if (webhookUrl) {
            try {
                fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newFeedback)
                }).catch(e => console.warn("Webhook dispatch error:", e));
            } catch (wErr) {}
        }

        // 3. Pre-formatted WhatsApp link for direct fast contact
        const waText = `היי, שלחתי פידבק ל-CS Trim:%0A*סוג:* ${encodeURIComponent(typeLabel)}%0A*פידבק:* ${encodeURIComponent(cleanMessage)}${cleanContact ? `%0A*יצירת קשר:* ${encodeURIComponent(cleanContact)}` : ""}%0A*גרסה:* ${encodeURIComponent(cleanVersion)}`;
        const whatsappUrl = `https://api.whatsapp.com/send?text=${waText}`;

        return res.status(200).json({
            success: true,
            savedToGitHub: savedToGitHub,
            message: "תודה רבה! הפידבק שלך נשמר בהצלחה ועוזר לנו לשפר את התוסף.",
            whatsappUrl: whatsappUrl
        });

    } catch (err) {
        console.error("Feedback error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error"
        });
    }
}
