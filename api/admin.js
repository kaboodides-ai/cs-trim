import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Default admin password if not provided in Vercel environment variables
const DEFAULT_ADMIN_PASSWORD = "LiamAdmin2026!";

// In-memory live sessions map: installId -> { installId, platform, version, lastPing, isConnected }
const liveSessions = new Map();

// Generate a daily rolling secret for token signing
const SECRET_SALT = process.env.ADMIN_SECRET || "cstrim_salt_" + new Date().toISOString().slice(0, 7);

function getAdminPassword() {
    return (process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD).trim();
}

function generateToken() {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const payload = `${expiresAt}:${getAdminPassword()}:${SECRET_SALT}`;
    const hash = crypto.createHash("sha256").update(payload).digest("hex");
    return Buffer.from(JSON.stringify({ expiresAt, hash })).toString("base64");
}

function verifyToken(token) {
    if (!token) return false;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
        if (!decoded || !decoded.expiresAt || !decoded.hash) return false;
        if (Date.now() > decoded.expiresAt) return false;

        const expectedPayload = `${decoded.expiresAt}:${getAdminPassword()}:${SECRET_SALT}`;
        const expectedHash = crypto.createHash("sha256").update(expectedPayload).digest("hex");
        return crypto.timingSafeEqual(Buffer.from(decoded.hash), Buffer.from(expectedHash));
    } catch (e) {
        return false;
    }
}

function isAuthorized(req) {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        if (verifyToken(token)) return true;
        // Also allow passing direct password as Bearer token
        if (token === getAdminPassword()) return true;
    }
    const queryPass = req.query.pass || req.query.password || "";
    if (queryPass && queryPass === getAdminPassword()) return true;
    return false;
}

// GitHub API helper for persisting JSON files
async function updateGitHubFile(filePath, updateCallback, commitMessage) {
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

    if (!token) {
        console.warn(`[Admin Storage] No GitHub token, updating file locally if possible: ${filePath}`);
        return false;
    }

    try {
        const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const getRes = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "cs-trim-admin"
            }
        });

        let sha = null;
        let currentData = {};

        if (getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
            try {
                const contentStr = Buffer.from(fileData.content, "base64").toString("utf8");
                currentData = JSON.parse(contentStr);
            } catch (e) {}
        }

        const modifiedData = updateCallback(currentData);
        if (!modifiedData) return false;

        const contentBase64 = Buffer.from(JSON.stringify(modifiedData, null, 2), "utf8").toString("base64");
        const putPayload = {
            message: commitMessage || `Update ${filePath}`,
            content: contentBase64,
            branch: "main"
        };
        if (sha) putPayload.sha = sha;

        const putRes = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "cs-trim-admin"
            },
            body: JSON.stringify(putPayload)
        });

        return putRes.ok;
    } catch (err) {
        console.warn(`[Admin Storage] GitHub update error for ${filePath}:`, err.message);
        return false;
    }
}

function readLocalJson(filename, fallback) {
    try {
        const fullPath = path.join(process.cwd(), "website", filename);
        if (fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath, "utf8"));
        }
    } catch (e) {}
    return fallback;
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const action = req.query.action || req.body?.action || "stats";

    // -------------------------------------------------------------------------
    // 1. HEARTBEAT FROM PREMIERE PRO (Public endpoint for plugin)
    // -------------------------------------------------------------------------
    if (action === "heartbeat") {
        try {
            let body = req.body || {};
            if (typeof body === "string") {
                try { body = JSON.parse(body); } catch (e) {}
            }
            const installId = (body.installId || "unknown").slice(0, 100);
            const platform = (body.platform || "Unknown").slice(0, 50);
            const version = (body.version || "1.0.9").slice(0, 30);
            const isConnected = Boolean(body.isConnected !== false);
            const isClosing = Boolean(body.isClosing || body.status === "offline");
            const now = Date.now();

            if (isClosing) {
                liveSessions.delete(installId);
                return res.status(200).json({ ok: true, disconnected: true, activeUsers: liveSessions.size });
            }

            liveSessions.set(installId, {
                installId: installId,
                platform: platform,
                version: version,
                isConnected: isConnected,
                lastPing: now,
                lastSeenFormatted: new Date(now).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
            });

            // Async record in sessions.json on GitHub (fire and forget)
            updateGitHubFile("website/sessions.json", function(data) {
                const sessions = Array.isArray(data.sessions) ? data.sessions : [];
                const existingIdx = sessions.findIndex(s => s.installId === installId);
                const sessionRecord = {
                    installId: installId,
                    platform: platform,
                    version: version,
                    lastSeen: new Date().toISOString(),
                    lastSeenFormatted: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
                    totalLaunches: (existingIdx !== -1 && sessions[existingIdx].totalLaunches) ? sessions[existingIdx].totalLaunches + 1 : 1
                };

                if (existingIdx !== -1) {
                    sessions[existingIdx] = sessionRecord;
                } else {
                    sessions.unshift(sessionRecord);
                }
                return { sessions: sessions, lastUpdated: new Date().toISOString().slice(0, 10) };
            }, `Heartbeat: active session ${platform} [${installId.slice(0, 8)}]`).catch(() => {});

            return res.status(200).json({ ok: true, activeUsers: liveSessions.size });
        } catch (err) {
            return res.status(200).json({ ok: false, error: err.message });
        }
    }

    // -------------------------------------------------------------------------
    // 2. RECORD LEAD (Called on website download)
    // -------------------------------------------------------------------------
    if (action === "record-lead") {
        try {
            const body = req.body || {};
            const email = (body.email || "").trim().toLowerCase();
            const platform = body.platform || "Windows";
            const fileName = body.fileName || "CS-Trim-Setup.exe";

            if (!email || !email.includes("@")) {
                return res.status(400).json({ error: "Invalid email" });
            }

            const newLead = {
                email: email,
                platform: platform,
                fileName: fileName,
                dateFormatted: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
                timestamp: new Date().toISOString()
            };

            // Save to website/leads.json on GitHub
            await updateGitHubFile("website/leads.json", function(data) {
                const leads = Array.isArray(data.leads) ? data.leads : [];
                // Check if email already recorded recently to prevent duplicates
                const exists = leads.find(l => l.email === email && Math.abs(new Date(l.timestamp || 0) - new Date()) < 60000);
                if (!exists) {
                    leads.unshift(newLead);
                }
                return { leads: leads, lastUpdated: new Date().toISOString().slice(0, 10) };
            }, `New lead download: ${email} (${platform})`);

            return res.status(200).json({ ok: true, lead: newLead });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------------------
    // 3. ADMIN AUTHENTICATION (Login)
    // -------------------------------------------------------------------------
    if (action === "login") {
        const providedPassword = (req.body?.password || req.query.password || "").trim();
        if (providedPassword === getAdminPassword()) {
            const token = generateToken();
            return res.status(200).json({
                success: true,
                token: token,
                message: "התחברת בהצלחה לאדמין פאנל"
            });
        }
        return res.status(401).json({
            success: false,
            error: "סיסמת מנהל שגויה. אנא נסה שנית."
        });
    }

    // -------------------------------------------------------------------------
    // SECURITY CHECK: All routes below REQUIRE Admin Authentication
    // -------------------------------------------------------------------------
    if (!isAuthorized(req)) {
        return res.status(401).json({
            error: "Unauthorized",
            message: "אין גישה לדף זה ללא סיסמת מנהל מורשית."
        });
    }

    // -------------------------------------------------------------------------
    // 4. STATS & DASHBOARD DATA (Protected)
    // -------------------------------------------------------------------------
    if (action === "stats") {
        try {
            const now = Date.now();
            const liveThresholdMs = 75 * 1000; // 75 seconds threshold for ultra-accurate live count
            const liveList = [];
            for (const [id, session] of liveSessions.entries()) {
                if (now - session.lastPing < liveThresholdMs) {
                    liveList.push(session);
                } else {
                    liveSessions.delete(id); // immediately drop expired sessions
                }
            }

            // Read leads, persistent sessions, and feedbacks
            const leadsData = readLocalJson("leads.json", { leads: [] });
            const sessionsData = readLocalJson("sessions.json", { sessions: [] });
            const feedbacksData = readLocalJson("feedbacks.json", { feedbacks: [] });

            const leads = Array.isArray(leadsData.leads) ? leadsData.leads : [];
            const allSessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];
            const feedbacks = Array.isArray(feedbacksData.feedbacks) ? feedbacksData.feedbacks : [];

            // Calculate metrics
            const totalDownloads = leads.length;
            const downloadsWindows = leads.filter(l => (l.platform || "").toLowerCase().includes("win")).length;
            const downloadsMac = leads.filter(l => (l.platform || "").toLowerCase().includes("mac")).length;

            return res.status(200).json({
                success: true,
                metrics: {
                    totalDownloads: totalDownloads,
                    downloadsWindows: downloadsWindows,
                    downloadsMac: downloadsMac,
                    liveUsersCount: liveList.length,
                    totalInstalls: Math.max(allSessions.length, liveList.length),
                    totalFeedbacks: feedbacks.length
                },
                liveUsers: liveList,
                allSessions: allSessions,
                leads: leads,
                feedbacks: feedbacks,
                serverTime: new Date().toISOString()
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(400).json({ error: "Unknown action" });
}

