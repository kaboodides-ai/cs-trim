/**
 * CS Trim - Support chat (help bot)
 * Sends the conversation plus version/platform/recent log lines to /api/support.
 * The AI key lives on the server only.
 */
var SUPPORT_ENDPOINT = "https://cstrim.site/api/support";
var supportHistory = [];
var supportBusy = false;

function supportAddBubble(role, text) {
    var box = document.getElementById("supportMessages");
    if (!box) return null;
    var b = document.createElement("div");
    b.className = "support-bubble support-" + role;
    b.textContent = text;
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    return b;
}

function supportCollectLogs() {
    var entries = document.querySelectorAll("#consoleBox .log-entry");
    var lines = [];
    for (var i = Math.max(0, entries.length - 15); i < entries.length; i++) {
        lines.push(entries[i].textContent.replace(/\s+/g, " ").trim());
    }
    // Drop user folder names from file paths before sending
    return lines.join("\n")
        .replace(/\/Users\/[^\/\s]+/g, "/Users/~")
        .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, "$1~");
}

function supportContext() {
    var version = (typeof AutoUpdater !== "undefined" && AutoUpdater.CURRENT_VERSION) ? AutoUpdater.CURRENT_VERSION : "?";
    return { version: version, platform: navigator.platform || "?", logs: supportCollectLogs() };
}

function openSupportChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    var modal = document.getElementById("supportChatModal");
    if (!modal) return;
    modal.style.display = "flex";
    if (supportHistory.length === 0) {
        supportAddBubble("bot", "היי! אני העוזר של CS Trim. מה לא עובד לך?");
    }
    var input = document.getElementById("supportInput");
    if (input) setTimeout(function () { input.focus(); }, 120);
}

function closeSupportChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    var modal = document.getElementById("supportChatModal");
    if (modal) modal.style.display = "none";
}

function handleSupportOverlayClick(e) {
    if (e && e.target && e.target.id === "supportChatModal") closeSupportChat(e);
}

function sendSupportMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (supportBusy) return;
    var input = document.getElementById("supportInput");
    var text = (input && input.value || "").trim();
    if (!text) return;
    input.value = "";

    supportAddBubble("user", text);
    supportHistory.push({ role: "user", content: text });
    supportBusy = true;
    var sendBtn = document.getElementById("supportSend");
    if (sendBtn) sendBtn.disabled = true;
    var pending = supportAddBubble("bot", "חושב...");

    function finish(msg, ok) {
        supportBusy = false;
        if (sendBtn) sendBtn.disabled = false;
        if (pending) pending.textContent = msg;
        if (ok) supportHistory.push({ role: "assistant", content: msg });
        else supportHistory.pop();
        var box = document.getElementById("supportMessages");
        if (box) box.scrollTop = box.scrollHeight;
    }

    fetch(SUPPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: supportHistory, context: supportContext() })
    })
    .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    })
    .then(function (r) {
        if (r.ok && r.data && r.data.reply) finish(r.data.reply, true);
        else finish((r.data && r.data.error) || "משהו השתבש. נסה שוב.", false);
    })
    .catch(function () {
        finish("אין חיבור לשרת. בדוק אינטרנט ונסה שוב.", false);
    });
}

// Hand off to the existing feedback form, pre-filled with the conversation
function supportToHuman(e) {
    if (e && e.preventDefault) e.preventDefault();
    var lines = supportHistory.map(function (m) {
        return (m.role === "user" ? "משתמש: " : "בוט: ") + m.content;
    });
    var ctx = supportContext();
    var summary = lines.join("\n").slice(0, 1500) + "\n---\nגרסה: " + ctx.version + " | " + ctx.platform;
    closeSupportChat();
    if (typeof openFeedbackModal === "function") openFeedbackModal();
    var msg = document.getElementById("pluginFbMessage");
    if (msg) msg.value = summary;
    var bug = document.querySelector('input[name="pluginFbType"][value="bug"]');
    if (bug) { bug.checked = true; if (typeof updatePluginFbTypePill === "function") updatePluginFbTypePill(bug); }
}
