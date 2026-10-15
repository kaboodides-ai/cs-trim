// In-memory rate limiting map (IP -> timestamps array)
const rateLimitMap = new Map();

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 10; // max 10 requests per 5 minutes

    const timestamps = rateLimitMap.get(ip) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
        return true;
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);

    // Clean up old entries periodically
    if (rateLimitMap.size > 1000) {
        for (const [key, times] of rateLimitMap.entries()) {
            if (times.every(t => now - t >= windowMs)) {
                rateLimitMap.delete(key);
            }
        }
    }
    return false;
}

// Fundamental Hebrew core words that can NEVER be replaced as typos
const RESERVED_CORE_WORDS = new Set([
    // מילות יחס, גוף וכינויים
    "של", "את", "על", "עם", "אם", "אל", "מן", "זה", "זו", "זאת", "אלה", "אלו",
    "אני", "אתה", "את", "הוא", "היא", "אנחנו", "אתם", "אתן", "הם", "הן",
    "לי", "לך", "לו", "לה", "לנו", "לכם", "להם",
    "בי", "בך", "בו", "בה", "בנו", "בכם", "בהם",
    "אותי", "אותך", "אותו", "אותה", "אותנו", "אתכם", "אותם",
    "שלי", "שלך", "שלו", "שלה", "שלנו", "שלכם", "שלהם",
    // שלילה, שאלה, קישור
    "לא", "כן", "אין", "יש", "רק", "כל", "מה", "מי", "איך", "כיצד", "למה", "מדוע",
    "איפה", "היכן", "מתי", "לאן", "כי", "אבל", "אך", "גם", "עוד", "כבר",
    "שם", "פה", "כאן", "עכשיו", "היום", "אתמול", "מחר",
    // שמות תואר ופעלים בסיסיים
    "טוב", "רע", "יפה", "גדול", "קטן", "הרבה", "קצת", "מאוד",
    "אמר", "אמרה", "היה", "הייתה", "היו", "יהיה", "תהיה",
    "תודה", "שלום", "בבקשה", "בסדר", "אוקיי", "אוקי"
]);

// Profanity & vulgar blacklist
const PROFANITY_LIST = [
    "זונה", "זונות", "שרמוטה", "שרמוט", "מניאק", "מניאקים",
    "כוס", "כוסיות", "זין", "זינים", "בן זונה", "בני זונות",
    "קוקסינל", "קוקסינלים", "נאצי", "נאצים", "היטלר", "שרלילה",
    "מזדיין", "מזדיינת", "תזדיין", "תזדייני", "להזדיין", "הזדיינות",
    "fuck", "shit", "bitch", "asshole", "dick", "pussy", "nigger", "faggot"
];

function containsProfanity(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return PROFANITY_LIST.some(word => lower.includes(word));
}

// Check similarity between strings
function hasReasonableSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().replace(/[\s\-_'"]/g, "");
    const s2 = str2.toLowerCase().replace(/[\s\-_'"]/g, "");
    
    // Check common unique characters
    const set1 = new Set(s1.split(""));
    const set2 = new Set(s2.split(""));
    let overlap = 0;
    for (const c of set1) {
        if (set2.has(c)) overlap++;
    }
    const maxChars = Math.max(set1.size, set2.size);
    if (maxChars <= 2) return true;
    
    // Overlap should be at least 35% for phonetic similarity
    return (overlap / maxChars) >= 0.35;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const clientIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress || "";
        
        // Rate limiting
        if (isRateLimited(clientIp)) {
            return res.status(429).json({
                error: "שלחת יותר מדי בקשות בזמן קצר. אנא המתן מספר דקות."
            });
        }

        const { wrongWord, correctWord, exampleSentence, website_trap } = req.body || {};

        // Honeypot check (anti-bot trap)
        if (website_trap) {
            return res.status(200).json({
                success: true,
                message: "המילה נקלטה בהצלחה",
                automated: false
            });
        }

        const wrong = (wrongWord || "").trim();
        const correct = (correctWord || "").trim();
        const example = (exampleSentence || "").trim();

        // 1. Mandatory presence check
        if (!wrong || !correct) {
            return res.status(400).json({ error: "יש להזין גם את המילה השגויה וגם את הצורה הנכונה" });
        }

        // 2. Length validation (2 - 30 chars)
        if (wrong.length < 2 || wrong.length > 30 || correct.length < 2 || correct.length > 30) {
            return res.status(400).json({ error: "אורך המילה חייב להיות בין 2 ל-30 תווים" });
        }

        // 3. Identical check
        if (wrong.toLowerCase() === correct.toLowerCase()) {
            return res.status(400).json({ error: "המילה השגויה והצורה הנכונה זהות לחלוטין" });
        }

        // 4. Character validation: Hebrew, English, numbers, spaces, hyphens, quotes/geresh
        const validCharRegex = /^[\u0590-\u05FFa-zA-Z0-9\s'"״׳\-]+$/;
        if (!validCharRegex.test(wrong) || !validCharRegex.test(correct)) {
            return res.status(400).json({ error: "המילים יכולות להכיל אותיות, מספרים, רווחים או מקף בלבד" });
        }

        // 5. Gibberish / repetition detection (e.g. "אאאא", "חחחח")
        const repetitionRegex = /(.)\1{3,}/;
        if (repetitionRegex.test(wrong) || repetitionRegex.test(correct)) {
            return res.status(400).json({ error: "נא לא להזין אותיות חוזרות או ג'יבריש" });
        }

        // 6. Profanity check
        if (containsProfanity(wrong) || containsProfanity(correct) || containsProfanity(example)) {
            return res.status(400).json({ error: "התוכן מכיל מילים שאינן הולמות ואינו מורשה" });
        }

        // 7. Protected Stop Words (nobody can replace core Hebrew grammar words)
        if (RESERVED_CORE_WORDS.has(wrong)) {
            return res.status(400).json({ error: `המילה "${wrong}" היא מילת יסוד בסיסית בעברית ולא ניתן להחליפה` });
        }

        // 8. Length Delta check (typo replacement shouldn't differ drastically in length)
        if (Math.abs(wrong.length - correct.length) > 7) {
            return res.status(400).json({ error: "הפרש האותיות בין המילה השגויה לנכונה גדול מדי עבור שגיאת כתיב" });
        }

        // 9. Similarity check (prevents replacing completely unrelated words)
        if (!hasReasonableSimilarity(wrong, correct)) {
            return res.status(400).json({ error: "המילים אינן דומות בצליל או באותיות (לא נראה כשגיאת כתיב או תעתיק)" });
        }

        // 10. Optional Groq AI Validator (if GROQ_API_KEY is configured in Vercel)
        const groqKey = (process.env.GROQ_API_KEY || process.env.groq_api_key || "").trim();
        if (groqKey) {
            try {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        temperature: 0.1,
                        response_format: { type: "json_object" },
                        messages: [
                            {
                                role: "system",
                                content: `You are a strict Hebrew linguistic safety filter.
You must validate if a user-submitted typo correction pair is appropriate for video subtitle transcription:
- Is [wrong] a plausible spelling mistake, phonetic transcription error, or transliteration variant for [correct] in Hebrew?
- Is [correct] a real/sensible Hebrew word, name, or brand?
- REJECT if it is vandalism, unrelated words (e.g. "כלב" -> "חתול"), profanity, a joke, or nonsense.
Return ONLY valid JSON:
{"valid": true or false, "reason": "brief Hebrew explanation if invalid"}`
                            },
                            {
                                role: "user",
                                content: `Wrong: "${wrong}", Correct: "${correct}", Context: "${example}"`
                            }
                        ]
                    })
                });

                if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    const aiResult = JSON.parse(groqData.choices?.[0]?.message?.content || "{}");
                    if (aiResult.valid === false) {
                        return res.status(400).json({
                            error: aiResult.reason || "ההצעה נדחתה על ידי בדיקת הדיוק הלשונית האוטומטית"
                        });
                    }
                }
            } catch (aiErr) {
                console.warn("Groq validation check skipped due to error:", aiErr.message);
                // Non-blocking: fallback to the rule-based guards above
            }
        }

        // Token discovery
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
        const filePath = "website/corrections.json";

        if (!token) {
            console.log(`[Typo Suggestion Logged] "${wrong}" -> "${correct}" (Example: "${example || ''}")`);
            return res.status(200).json({
                success: true,
                message: "המילה נקלטה בהצלחה במערכת",
                automated: false
            });
        }

        // Fetch current corrections.json from GitHub
        const getUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const getRes = await fetch(getUrl, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "cs-trim-auto-updater"
            }
        });

        if (!getRes.ok) {
            const errBody = await getRes.text();
            throw new Error(`Failed to read corrections.json from GitHub (${getRes.status}): ${errBody}`);
        }

        const fileData = await getRes.json();
        const sha = fileData.sha;
        const existingContent = Buffer.from(fileData.content, "base64").toString("utf8");
        const json = JSON.parse(existingContent);

        if (!json.corrections) {
            json.corrections = {};
        }

        // Duplicate check
        if (json.corrections[wrong] === correct) {
            return res.status(200).json({
                success: true,
                message: `המילה "${wrong}" כבר קיימת ומתוקנת ל-"${correct}" במערכת!`,
                automated: true
            });
        }

        // Add the new correction
        json.corrections[wrong] = correct;
        json.lastUpdated = new Date().toISOString().split("T")[0];

        const updatedContentBase64 = Buffer.from(JSON.stringify(json, null, 2), "utf8").toString("base64");

        // Commit the updated file directly to main branch
        const putRes = await fetch(getUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "cs-trim-auto-updater"
            },
            body: JSON.stringify({
                message: `Automated typo correction: "${wrong}" -> "${correct}"`,
                content: updatedContentBase64,
                sha: sha,
                branch: "main"
            })
        });

        if (!putRes.ok) {
            const putErr = await putRes.text();
            throw new Error(`Failed to commit to GitHub: ${putErr}`);
        }

        return res.status(200).json({
            success: true,
            message: `המילה "${wrong}" ➔ "${correct}" נוספה בהצלחה ופורסמה לכל המשתמשים!`,
            automated: true
        });

    } catch (err) {
        console.error("Auto suggest error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error"
        });
    }
}
