export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { wrongWord, correctWord, exampleSentence } = req.body || {};

        const wrong = (wrongWord || "").trim();
        const correct = (correctWord || "").trim();

        if (!wrong || !correct) {
            return res.status(400).json({ error: "Missing wrong or correct word" });
        }

        // Basic sanity checks: avoid single character or identical replacements
        if (wrong.length < 2 || correct.length < 2 || wrong.toLowerCase() === correct.toLowerCase()) {
            return res.status(400).json({ error: "Invalid word pair" });
        }

        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || "kaboodides-ai/cs-trim";
        const filePath = "website/corrections.json";

        if (!token) {
            console.log(`[Typo Suggestion Logged] "${wrong}" -> "${correct}" (Example: "${exampleSentence || ''}")`);
            return res.status(200).json({
                success: true,
                message: "המילה נקלטה בהצלחה במערכת",
                automated: false
            });
        }

        // 1. Fetch current corrections.json from GitHub
        const getUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const getRes = await fetch(getUrl, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "cs-trim-auto-updater"
            }
        });

        if (!getRes.ok) {
            throw new Error(`Failed to read corrections.json from GitHub: ${getRes.status}`);
        }

        const fileData = await getRes.json();
        const sha = fileData.sha;
        const existingContent = Buffer.from(fileData.content, "base64").toString("utf8");
        const json = JSON.parse(existingContent);

        if (!json.corrections) {
            json.corrections = {};
        }

        // Add the new correction
        json.corrections[wrong] = correct;
        json.lastUpdated = new Date().toISOString().split("T")[0];

        const updatedContentBase64 = Buffer.from(JSON.stringify(json, null, 2), "utf8").toString("base64");

        // 2. Commit the updated file directly to main branch
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
            message: "המילה נוספה בהצלחה ופורסמה אוטומטית לכל המשתמשים!",
            automated: true
        });

    } catch (err) {
        console.error("Auto suggest error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error"
        });
    }
}
