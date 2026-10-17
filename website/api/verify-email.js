import dns from "node:dns";

// In-memory rate limiting map (IP -> timestamps array)
const rateLimitMap = new Map();

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 30; // max 30 requests per 5 minutes

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

// Known disposable & burner email providers
const DISPOSABLE_DOMAINS = new Set([
    "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com", "guerrillamail.com",
    "guerrillamail.net", "guerrillamail.biz", "guerrillamail.org", "guerrillamailblock.com",
    "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.net", "trashmail.me",
    "sharklasers.com", "getairmail.com", "dispostable.com", "throwawaymail.com", "fakeinbox.com",
    "maildrop.cc", "inboxkitten.com", "mohmal.com", "burnermail.io", "crazymailing.com",
    "generator.email", "tempail.com", "fakemailgenerator.com", "nada.ltd", "dropmail.me",
    "emailondeck.com", "mintemail.com", "spamgourmet.com", "mytemp.email", "disposablemail.com",
    "getnada.com", "airmail.news", "abczmail.com", "spambox.us", "mytempemail.com", "temp-mail.io",
    "internxt.com", "emailfake.com", "tempmailo.com", "zillamail.com", "bupmail.com",
    "throwawayemailaddress.com", "meltmail.com", "hidemail.com", "disposableaddress.com",
    "harakirimail.com", "cuvox.de", "dayrep.com", "fleckens.hu", "gustr.com", "jourrapide.com",
    "rhyta.com", "superrito.com", "teleworm.us", "armyspy.com", "einrot.com", "chacuo.net",
    "trashymail.com", "deadaddress.com", "trashmail.io", "tempmail.net", "disbox.net"
]);

// Reserved and dummy domains (RFC reserved)
const RESERVED_DOMAINS = new Set([
    "example.com", "example.org", "example.net", "test.com", "invalid.com", "localhost.com"
]);

// Common domain typos and their corrections
const DOMAIN_TYPOS = {
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmaik.com": "gmail.com",
    "gmail.con": "gmail.com",
    "gmail.cm": "gmail.com",
    "gmail.co": "gmail.com",
    "gemail.com": "gmail.com",
    "gmail.co.il": "gmail.com",
    "g-mail.com": "gmail.com",
    "gmaol.com": "gmail.com",
    "gmaul.com": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotmil.com": "hotmail.com",
    "hotamil.com": "hotmail.com",
    "homail.com": "hotmail.com",
    "hotmail.con": "hotmail.com",
    "hotmail.co.il": "hotmail.com",
    "outlok.com": "outlook.com",
    "outluk.com": "outlook.com",
    "ootlook.com": "outlook.com",
    "putlook.com": "outlook.com",
    "outlook.con": "outlook.com",
    "yaoo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yahu.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "yaho.co.il": "yahoo.com",
    "wala.co.il": "walla.co.il",
    "wallla.co.il": "walla.co.il",
    "walla.il": "walla.co.il",
    "walla.com.il": "walla.co.il",
    "iclod.com": "icloud.com",
    "icluod.com": "icloud.com",
    "icloud.con": "icloud.com"
};

// Known explicit troll email addresses
const FAKE_FULL_EMAILS = new Set([
    "test@test.com", "asdf@asdf.com", "a@a.com", "fake@fake.com", "me@me.com",
    "123@123.com", "abc@abc.com", "qwer@qwer.com", "none@none.com", "null@null.com",
    "no@no.com", "spam@spam.com", "test@example.com", "asdf@gmail.com", "test@gmail.com",
    "123456@gmail.com", "123@gmail.com", "aaaa@gmail.com", "fake@gmail.com"
]);

// Pure keyboard mash / test words (only blocked if the exact localPart is one of these)
const DUMMY_LOCAL_PARTS = new Set([
    "asdf", "asdfg", "asdfgh", "qwer", "qwerty", "zxcv",
    "123456", "fake", "dummy", "noemail", "fakeemail"
]);

// Top major email providers guaranteed to have valid MX
const TOP_VERIFIED_PROVIDERS = new Set([
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.fr", "icloud.com", "me.com", "mac.com",
    "walla.co.il", "walla.com", "proton.me", "protonmail.com", "aol.com", "zoho.com",
    "mail.com", "email.com", "gmx.com", "yandex.com",
    "012.net.il", "netvision.net.il", "bezeqint.net"
]);

// Verify MX records using Node.js dns or Google DoH fallback
async function checkDomainMx(domain) {
    if (TOP_VERIFIED_PROVIDERS.has(domain)) {
        return { valid: true, cached: true };
    }

    // 1. Try Node.js DNS resolveMx
    try {
        const records = await dns.promises.resolveMx(domain);
        if (records && records.length > 0) {
            const hasValidMx = records.some(r => r && r.exchange && r.exchange !== "." && r.exchange !== "");
            if (hasValidMx) {
                return { valid: true, mx: records };
            }
            return { valid: false, reason: "null_mx", message: "הדומיין שהוזן אינו מוגדר לקבלת אימיילים" };
        }
    } catch (dnsErr) {
        if (dnsErr.code === "ENOTFOUND" || dnsErr.code === "ENODATA" || dnsErr.code === "ESERVFAIL") {
            return { valid: false, reason: "domain_not_found", message: "הדומיין שהוזן אינו קיים ברשת" };
        }
        // If system resolver had an error, try Google DoH as fallback
    }

    // 2. Fallback to Google DNS over HTTPS
    try {
        const dohUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(dohUrl, {
            signal: controller.signal,
            headers: { "Accept": "application/json" }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            // Status 0 = NOERROR, Status 3 = NXDOMAIN
            if (data.Status === 3) {
                return { valid: false, reason: "domain_not_found", message: "הדומיין שהוזן אינו קיים ברשת" };
            }
            const answers = data.Answer || [];
            if (answers.length > 0) {
                const hasValid = answers.some(a => a && a.data && !a.data.endsWith(" .") && a.data !== ".");
                if (hasValid) {
                    return { valid: true, doh: true };
                }
                return { valid: false, reason: "null_mx", message: "הדומיין שהוזן אינו מוגדר לקבלת מיילים" };
            }
            return { valid: false, reason: "no_mx", message: "לדומיין שהוזן אין שרתי אימייל פעילים" };
        }
    } catch (dohErr) {
        // If network times out, don't block legitimate users
    }

    // Fallback: If we couldn't definitively check DNS, allow valid-looking domains
    return { valid: true, fallback: true };
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const clientIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "";
    if (isRateLimited(clientIp)) {
        return res.status(429).json({
            valid: false,
            error: "שלחת מספר בקשות ברצף. אנא המתן דקה ונסה שוב."
        });
    }

    let rawEmail = "";
    if (req.method === "POST") {
        const body = req.body || {};
        rawEmail = body.email || "";
    } else {
        rawEmail = req.query?.email || "";
    }

    const email = (rawEmail || "").trim().toLowerCase();

    if (!email) {
        return res.status(400).json({
            valid: false,
            reason: "empty",
            message: "נא להזין כתובת אימייל"
        });
    }

    // RFC 5322 regex validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email)) {
        return res.status(200).json({
            valid: false,
            reason: "syntax",
            message: "מבנה כתובת האימייל אינו תקין (לדוגמה: name@gmail.com)"
        });
    }

    const [localPart, domain] = email.split("@");

    if (!localPart || !domain) {
        return res.status(200).json({
            valid: false,
            reason: "syntax",
            message: "כתובת האימייל אינה שלמה"
        });
    }

    // Check TLD
    const domainParts = domain.split(".");
    const tld = domainParts[domainParts.length - 1];
    if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
        return res.status(200).json({
            valid: false,
            reason: "invalid_tld",
            message: "סיומת הדומיין אינה תקינה (למשל .com, .co.il)"
        });
    }

    // Domain typo detection
    if (DOMAIN_TYPOS[domain]) {
        const suggestedDomain = DOMAIN_TYPOS[domain];
        const suggestedEmail = `${localPart}@${suggestedDomain}`;
        return res.status(200).json({
            valid: false,
            reason: "typo",
            suggestedEmail: suggestedEmail,
            suggestedDomain: suggestedDomain,
            message: `נראה שנפלה שגיאת הקלדה. האם התכוונת ל-${suggestedEmail}?`
        });
    }

    // Known explicit troll email addresses
    if (FAKE_FULL_EMAILS.has(email)) {
        return res.status(200).json({
            valid: false,
            reason: "dummy_name",
            message: "נא להזין כתובת אימייל אישית אמיתית ולא כתובת בדיקה"
        });
    }

    // Dummy keyboard-mash local part check
    if (DUMMY_LOCAL_PARTS.has(localPart)) {
        return res.status(200).json({
            valid: false,
            reason: "dummy_name",
            message: "נא להזין כתובת אימייל אישית אמיתית ולא כתובת בדיקה"
        });
    }

    // Repeated characters check (only if 6 or more of the exact same character, e.g. "aaaaaa")
    if (localPart.length >= 6 && new Set(localPart.split("")).size === 1) {
        return res.status(200).json({
            valid: false,
            reason: "repeated_chars",
            message: "כתובת האימייל מכילה תווים חוזרים ואינה נראית אמיתית"
        });
    }

    // Disposable email check
    if (DISPOSABLE_DOMAINS.has(domain)) {
        return res.status(200).json({
            valid: false,
            reason: "disposable",
            message: "שירותי אימייל זמניים / חד-פעמיים אינם נתמכים. נא להזין אימייל אמיתי"
        });
    }

    // Reserved domain check
    if (RESERVED_DOMAINS.has(domain)) {
        return res.status(200).json({
            valid: false,
            reason: "reserved_domain",
            message: "הדומיין שהוזן אינו פעיל לקבלת דואר"
        });
    }

    // Provider-specific rules
    if (domain === "gmail.com" || domain === "googlemail.com") {
        const cleanGmailUser = localPart.replace(/\./g, "");
        if (cleanGmailUser.length < 6) {
            return res.status(200).json({
                valid: false,
                reason: "gmail_too_short",
                message: "שם משתמש ב-Gmail חייב להכיל לפחות 6 תווים"
            });
        }
    }

    // MX Record DNS Check
    const mxCheck = await checkDomainMx(domain);
    if (!mxCheck.valid) {
        return res.status(200).json({
            valid: false,
            reason: mxCheck.reason || "no_mx",
            message: mxCheck.message || "הדומיין שהוזן אינו קיים או אינו מוגדר לקבלת אימיילים"
        });
    }

    return res.status(200).json({
        valid: true,
        email: email,
        domain: domain,
        message: "כתובת האימייל אומתה בהצלחה"
    });
}

