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

// Fundamental Hebrew core words & common independent words that can NEVER be replaced as typos
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
    // מילים עצמאיות נפוצות שאינן שגיאות כתיב של מילים אחרות
    "קרחת", "קדחת", "אורחת", "אורח",
    "כלב", "חלב", "חבל", "חבר", "חרב", "בית", "זית", "ספר", "סיר", "סרט",
    "שמש", "ירח", "כוכב", "שמיים", "ענן", "גשם", "אש", "מים", "ים", "הר",
    "שקט", "שבט", "שבת", "בוקר", "מוקר", "ערב", "לילה", "צהריים", "יום", "שבוע", "חודש", "שנה", "שעה", "זמן",
    "איש", "אישה", "ילד", "ילדה", "אדם", "אנשים", "אבא", "אמא", "אח", "אחות", "בן", "בת",
    "ראש", "פנים", "עין", "עיניים", "אוזן", "אף", "פה", "שפה", "שן", "יד", "ידיים", "רגל", "רגליים", "לב", "גוף", "דם", "עור", "שיער",
    "דלת", "חלון", "חדר", "שולחן", "כיסא", "קיר", "בניין", "בית", "חנות",
    "אוכל", "לחם", "בשר", "דג", "גבינה", "פרי", "ירק", "קפה", "תה",
    "עבודה", "עובד", "מנהל", "משרד", "כסף", "שקל", "דולר", "מחיר", "דרך", "מקום",
    "בריאות", "מחלה", "חום", "רופא", "תרופה", "שלום", "מלחמה", "צבא", "חייל", "משטרה", "חוק", "משפט",
    "טוב", "רע", "יפה", "גדול", "קטן", "הרבה", "קצת", "מאוד", "חדש", "ישן", "חם", "קר", "קל", "קשה",
    "אמר", "אמרה", "היה", "הייתה", "היו", "יהיה", "תהיה",
    "תודה", "בבקשה", "בסדר", "אוקיי", "אוקי"
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

// Hebrew homophone groups (letters with identical/almost identical sounds in modern Hebrew)
const HOMOPHONE_GROUPS = [
    new Set(["ט", "ת", "ד"]),
    new Set(["כ", "ק", "ג", "ח"]),
    new Set(["א", "ע", "ה"]),
    new Set(["ס", "ש", "צ", "ז"]),
    new Set(["ב", "ו", "פ"]),
    new Set(["ד", "ר"]),
    new Set(["ל", "ר", "נ"]),
    new Set(["מ", "נ"])
];

const FINAL_LETTERS_MAP = {
    "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ"
};

const MATRES_LECTIONIS = new Set(["י", "ו", "א", "ה"]);

function normalizeHebrewChar(c) {
    return FINAL_LETTERS_MAP[c] || c;
}

function arePhoneticHomophones(c1, c2) {
    const n1 = normalizeHebrewChar(c1);
    const n2 = normalizeHebrewChar(c2);
    if (n1 === n2) return true;
    for (const group of HOMOPHONE_GROUPS) {
        if (group.has(n1) && group.has(n2)) return true;
    }
    return false;
}

// Strict Hebrew phonetic & typo similarity validator.
// Rejects unrelated words (e.g. 'קרחת' vs 'קדחת', 'שקט' vs 'שבט') where consonants are not homophonic.
function validateHebrewTypoSimilarity(wrong, correct) {
    const w = (wrong || "").trim().toLowerCase();
    const c = (correct || "").trim().toLowerCase();

    if (w === c) {
        return { valid: false, reason: "המילה השגויה והצורה הנכונה זהות לחלוטין" };
    }

    const cleanRegex = /[\s\-_'"״׳]/g;
    const wClean = w.replace(cleanRegex, "").split("").map(normalizeHebrewChar).join("");
    const cClean = c.replace(cleanRegex, "").split("").map(normalizeHebrewChar).join("");

    if (!wClean || !cClean) {
        return { valid: false, reason: "נא להזין מילים תקינות בעברית" };
    }

    // 1. Spacing or punctuation error (e.g. "טיק טוק" -> "טיקטוק", "יו טיוב" -> "יוטיוב")
    if (wClean === cClean) {
        return { valid: true };
    }

    // 2. Transliteration variant (e.g. צ <-> טס / תס like "וואצאפ" -> "וואטסאפ")
    const wTrans = wClean.replace(/טס/g, "צ").replace(/תס/g, "צ");
    const cTrans = cClean.replace(/טס/g, "צ").replace(/תס/g, "צ");
    if (wTrans === cTrans) {
        return { valid: true };
    }

    // 3. Phonetic alignment distance
    const n = wClean.length;
    const m = cClean.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        const ch = wClean[i - 1];
        dp[i][0] = dp[i - 1][0] + (MATRES_LECTIONIS.has(ch) ? 1 : 2);
    }
    for (let j = 1; j <= m; j++) {
        const ch = cClean[j - 1];
        dp[0][j] = dp[0][j - 1] + (MATRES_LECTIONIS.has(ch) ? 1 : 2);
    }

    for (let i = 1; i <= n; i++) {
        const ch1 = wClean[i - 1];
        for (let j = 1; j <= m; j++) {
            const ch2 = cClean[j - 1];
            let subCost;
            if (ch1 === ch2) {
                subCost = 0;
            } else if (arePhoneticHomophones(ch1, ch2)) {
                subCost = 1; // Valid phonetic substitution (e.g. ט/ת, ק/כ)
            } else {
                subCost = 2; // Non-homophonic consonant mismatch (common in speech-recognition errors)
            }

            const delCost = MATRES_LECTIONIS.has(ch1) ? 1 : 2;
            const insCost = MATRES_LECTIONIS.has(ch2) ? 1 : 2;

            dp[i][j] = Math.min(
                dp[i - 1][j - 1] + subCost,
                dp[i - 1][j] + delCost,
                dp[i][j - 1] + insCost
            );
        }
    }

    const dist = dp[n][m];
    // Max allowed phonetic edits
    const maxAllowed = Math.max(3, Math.round(Math.max(n, m) * 0.9));

    if (dist <= maxAllowed) {
        return { valid: true };
    }

    return {
        valid: false,
        reason: "המילים אינן דומות בצליל ואינן חילוף אותיות פונטי תקין (חילוף אותיות כמו ר' ו-ד' נשמע שונה לחלוטין ואינו שגיאת כתיב)"
    };
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

        // 7. Protected Stop Words (nobody can replace core / common independent Hebrew words)
        if (RESERVED_CORE_WORDS.has(wrong)) {
            return res.status(400).json({ error: `המילה "${wrong}" היא מילה תקנית ועצמאית בעברית ולא ניתן להחליפה כשגיאת כתיב` });
        }

        // 8. Length Delta check (typo replacement shouldn't differ drastically in length)
        if (Math.abs(wrong.length - correct.length) > 7) {
            return res.status(400).json({ error: "הפרש האותיות בין המילה השגויה לנכונה גדול מדי עבור שגיאת כתיב" });
        }

        // 9. Phonetic & Typographic Similarity check (strictly rejects non-homophonic consonant differences like ר vs ד)
        const simResult = validateHebrewTypoSimilarity(wrong, correct);
        if (!simResult.valid) {
            return res.status(400).json({ error: simResult.reason || "המילים אינן דומות בצליל או באותיות (לא נראה כשגיאת כתיב או תעתיק)" });
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
                                content: `You are a strict Hebrew linguistic safety filter for an automated subtitle spelling corrector.
In video subtitles, dictionary replacements are applied GLOBALLY to all subtitles.

CRITICAL REJECTION RULES:
1. REJECT if [wrong] is already a legitimate, standard Hebrew word with its own meaning (e.g. "קרחת" = baldness vs "קדחת" = fever; "כלב" = dog vs "חלב" = milk; "בית" vs "זית"). Replacing an existing real word corrupts video subtitles whenever that word was intentionally spoken!
2. The corrections fix speech-recognition (transcription) mistakes, so similar-sounding or visually similar letters (e.g. ר/ד, ג/ק, ב/פ, ל/ר) ARE acceptable. Only reject if the words are clearly unrelated.
3. REJECT jokes, slang, vandalism, unrelated words, or insults.

ACCEPT:
- Genuine phonetic spelling mistakes in Hebrew (e.g. ט/ת, כ/ק, א/ע, ח/כ, ס/ש, ב/ו like "מקאבי" -> "מכבי", "הצירה" -> "עצירה").
- Foreign brand or loanword transliteration errors (e.g. "ספוטיפי" -> "ספוטיפיי", "וואצאפ" -> "וואטסאפ").
- Split / joined compound words (e.g. "טיק טוק" -> "טיקטוק", "יו טיוב" -> "יוטיוב").
- Missing or extra matres lectionis (כתיב מלא/חסר, e.g. "פריימיר" -> "פרמייר", "ניצחונות" -> "נצחונות").

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
