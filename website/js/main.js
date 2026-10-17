/**
 * CS Trim - Website Interactive Scripts
 * Handles timeline simulation, caption word-count simulator, FAQ accordion, and tab switching.
 */


// -----------------------------------------------------------------------------
// 2. Interactive Simulator 1: Timeline Silence Trimming
// -----------------------------------------------------------------------------
let simIsCut = false;

const TIMELINE_DATA = [
    { type: "speech", label: "שלום חברים", width: 14 },
    { type: "silence", width: 9 },
    { type: "speech", label: "היום נלמד", width: 16 },
    { type: "silence", width: 12 },
    { type: "speech", label: "איך לחסוך זמן", width: 18 },
    { type: "silence", width: 10 },
    { type: "speech", label: "בעריכת וידאו", width: 21 }
];

function renderTimeline(isCut) {
    const container = document.getElementById("simTimelineTrack");
    const durationText = document.getElementById("simDurationText");
    const savedText = document.getElementById("simSavedText");
    const btnSim = document.getElementById("btnSimTrigger");
    const btnBefore = document.getElementById("simModeBefore");
    const btnAfter = document.getElementById("simModeAfter");

    if (!container) return;

    container.innerHTML = "";

    TIMELINE_DATA.forEach((item, index) => {
        const clipEl = document.createElement("div");
        clipEl.className = `sim-clip ${item.type === "speech" ? "sim-clip-speech" : "sim-clip-silence"}`;
        
        if (item.type === "speech") {
            clipEl.innerText = item.label;
            clipEl.style.flex = isCut ? `${item.width * 1.5}` : `${item.width}`;
            clipEl.style.opacity = "1";
        } else {
            if (isCut) {
                clipEl.style.width = "0px";
                clipEl.style.padding = "0px";
                clipEl.style.margin = "0px";
                clipEl.style.border = "none";
                clipEl.style.opacity = "0";
            } else {
                clipEl.style.flex = `${item.width}`;
                clipEl.title = "שקט (נחתך אוטומטית)";
                clipEl.style.opacity = "1";
            }
        }
        container.appendChild(clipEl);
    });

    if (isCut) {
        if (durationText) durationText.innerText = "01:25 דקות (מהודק)";
        if (savedText) savedText.innerText = "02:20 דקות נחתכו (62% חיסכון!)";
        if (btnSim) btnSim.innerHTML = "<span> שקט נחתך! לחץ לשחזור גלם</span>";
        if (btnBefore) btnBefore.classList.remove("active");
        if (btnAfter) btnAfter.classList.add("active");
    } else {
        if (durationText) durationText.innerText = "03:45 דקות (גלם)";
        if (savedText) savedText.innerText = "0 שניות (ממתין לחיתוך)";
        if (btnSim) btnSim.innerHTML = "<span> הפעל חיתוך אוטומטי</span>";
        if (btnBefore) btnBefore.classList.add("active");
        if (btnAfter) btnAfter.classList.remove("active");
    }
}

function setSimCutMode(mode) {
    simIsCut = (mode === "after");
    renderTimeline(simIsCut);
}

function toggleSimCut() {
    simIsCut = !simIsCut;
    renderTimeline(simIsCut);
}

// -----------------------------------------------------------------------------
// 3. Interactive Simulator 2: Caption Words Slider & Phone Display
// -----------------------------------------------------------------------------
const SAMPLE_TEXT = "איך יוצרים סרטונים ויראליים ברשת בלי להוציא שקל על תוכנות יקרות";
let currentWordChunk = 3;
let captionInterval = null;
let wordHighlightSubInterval = null;
let currentChunkIndex = 0;
let simHighlightColor = "#FACC15";

function setSimHighlightColor(color, btn) {
    simHighlightColor = color;
    const btns = document.querySelectorAll(".sim-hl-btn");
    btns.forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    startCaptionLoop();
}

function chunkWordsList(text, n) {
    const words = text.split(" ");
    const chunks = [];
    for (let i = 0; i < words.length; i += n) {
        chunks.push(words.slice(i, i + n));
    }
    return chunks;
}

function updateWordSim(wordsPerCaption) {
    currentWordChunk = parseInt(wordsPerCaption, 10);
    const label = document.getElementById("simWordsLabel");
    if (label) {
        label.innerText = `${currentWordChunk} ${currentWordChunk === 1 ? "מילה" : "מילים"}`;
    }

    // Update active preset button highlight
    const presets = document.querySelectorAll(".preset-pill");
    presets.forEach(p => p.classList.remove("active"));
    const matchingPreset = Array.from(presets).find(p => p.textContent.includes(String(currentWordChunk)));
    if (matchingPreset) matchingPreset.classList.add("active");

    startCaptionLoop();
}

function setWordSimPreset(words) {
    const slider = document.getElementById("interactiveWordSlider");
    if (slider) slider.value = words;
    updateWordSim(words);
}

function startCaptionLoop() {
    if (captionInterval) clearInterval(captionInterval);
    if (wordHighlightSubInterval) clearInterval(wordHighlightSubInterval);

    const chunks = chunkWordsList(SAMPLE_TEXT, currentWordChunk);
    currentChunkIndex = 0;

    const displayBox = document.getElementById("simCaptionBox");
    if (!displayBox) return;

    const renderWords = (chunk, activeIdx) => {
        displayBox.innerHTML = "";
        chunk.forEach((word, wIdx) => {
            const span = document.createElement("span");
            span.className = "sim-word";
            span.textContent = word;
            if (simHighlightColor !== "none" && wIdx === activeIdx) {
                span.classList.add("sim-highlighted-word");
                span.style.backgroundColor = simHighlightColor;
            }
            displayBox.appendChild(span);
        });
    };

    const showNextChunk = () => {
        if (!chunks.length) return;
        if (wordHighlightSubInterval) clearInterval(wordHighlightSubInterval);

        const currentWords = chunks[currentChunkIndex];
        const chunkDuration = Math.max(900, currentWordChunk * 550);
        const perWordTime = Math.floor(chunkDuration / currentWords.length);

        // Trigger CSS popIn animation
        displayBox.style.animation = "none";
        void displayBox.offsetWidth;
        displayBox.style.animation = "popIn 0.25s ease";

        if (simHighlightColor === "none") {
            renderWords(currentWords, -1);
        } else {
            let activeWord = 0;
            renderWords(currentWords, activeWord);
            wordHighlightSubInterval = setInterval(() => {
                activeWord++;
                if (activeWord < currentWords.length) {
                    renderWords(currentWords, activeWord);
                } else {
                    clearInterval(wordHighlightSubInterval);
                }
            }, perWordTime);
        }

        currentChunkIndex = (currentChunkIndex + 1) % chunks.length;
    };

    showNextChunk();
    const intervalTime = Math.max(900, currentWordChunk * 550);
    captionInterval = setInterval(showNextChunk, intervalTime);
}

// -----------------------------------------------------------------------------
// 4. Installation Guide Tabs
// -----------------------------------------------------------------------------
function switchGuideTab(tab, el) {
    const tabs = document.querySelectorAll(".guide-tab");
    tabs.forEach(t => t.classList.remove("active"));

    const paneMac = document.getElementById("paneMac");
    const paneWin = document.getElementById("paneWin");
    const paneApi = document.getElementById("paneApi");

    if (paneMac) paneMac.style.display = "none";
    if (paneWin) paneWin.style.display = "none";
    if (paneApi) paneApi.style.display = "none";

    const tabMap = { win: 0, mac: 1, api: 2 };
    if (el) {
        el.classList.add("active");
    } else if (tabMap[tab] !== undefined && tabs[tabMap[tab]]) {
        tabs[tabMap[tab]].classList.add("active");
    }

    if (tab === "mac" && paneMac) paneMac.style.display = "block";
    if (tab === "win" && paneWin) paneWin.style.display = "block";
    if (tab === "api" && paneApi) paneApi.style.display = "block";
}

// -----------------------------------------------------------------------------
// 4b. Guide Screenshot Modal (Lightbox)
// -----------------------------------------------------------------------------
function openGuideModal(src, caption) {
    const modal = document.getElementById("guideModal");
    const img = document.getElementById("guideModalImg");
    const cap = document.getElementById("guideModalCaption");
    if (modal && img) {
        img.src = src;
        if (cap) cap.textContent = caption || "מדריך התקנה";
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }
}

function closeGuideModal() {
    const modal = document.getElementById("guideModal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeGuideModal();
    }
});

// -----------------------------------------------------------------------------
// 5. FAQ Accordion
// -----------------------------------------------------------------------------
function initFaq() {
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
        const btn = item.querySelector(".faq-question");
        btn.addEventListener("click", () => {
            const isActive = item.classList.contains("active");
            // Close all
            faqItems.forEach(i => i.classList.remove("active"));
            // Toggle current
            if (!isActive) {
                item.classList.add("active");
            }
        });
    });
}

// -----------------------------------------------------------------------------
// 6. Automatic OS Detection & Download Button Highlighting
// -----------------------------------------------------------------------------
function detectUserOS() {
    try {
        if (navigator.userAgentData && navigator.userAgentData.platform) {
            const p = navigator.userAgentData.platform.toLowerCase();
            if (p.includes("win")) return "win";
            if (p.includes("mac")) return "mac";
        }
    } catch (e) {}

    const ua = (navigator.userAgent || "").toLowerCase();
    const platform = (navigator.platform || "").toLowerCase();

    // Windows detection (checked first)
    if (ua.includes("windows") || ua.includes("win32") || ua.includes("win64") || platform.includes("win")) {
        return "win";
    }

    // Mac detection (excluding iOS devices)
    if (ua.includes("macintosh") || ua.includes("mac os") || platform.includes("mac")) {
        const isIOS = /ipad|iphone|ipod/.test(ua) || (platform === "macintel" && navigator.maxTouchPoints > 1);
        if (!isIOS) return "mac";
    }

    return "win";
}

function initOSDetection() {
    const os = detectUserOS();
    if (os !== "mac" && os !== "win") return;

    const isWin = (os === "win");
    const heroMac = document.getElementById("btnHeroDownloadMac");
    const heroWin = document.getElementById("btnHeroDownloadWin");
    const cardMac = document.getElementById("btnCardDownloadMac");
    const cardWin = document.getElementById("btnCardDownloadWin");

    function highlightButton(btn, isRecommended) {
        if (!btn) return;
        if (isRecommended) {
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary", "btn-os-highlight");
            if (!btn.querySelector(".os-pill-badge")) {
                const badge = document.createElement("span");
                badge.className = "os-pill-badge";
                badge.textContent = "למחשב שלך";
                btn.appendChild(badge);
            }
        } else {
            btn.classList.remove("btn-primary", "btn-os-highlight");
            btn.classList.add("btn-secondary");
            const badge = btn.querySelector(".os-pill-badge");
            if (badge) badge.remove();
        }
    }

    highlightButton(heroWin, isWin);
    highlightButton(heroMac, !isWin);

    highlightButton(cardWin, isWin);
    highlightButton(cardMac, !isWin);
}

// -----------------------------------------------------------------------------
// 7. Smooth Navbar Scroll & Init
// -----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    initOSDetection();
    renderTimeline(false);
    updateWordSim(3);
    initFaq();
    setupDownloadGating();

    // Auto open first FAQ
    const firstFaq = document.querySelector(".faq-item");
    if (firstFaq) firstFaq.classList.add("active");
});

// -----------------------------------------------------------------------------
// Hebrew Typo Pre-Validator (Client Side)
// -----------------------------------------------------------------------------
const CLIENT_RESERVED_WORDS = new Set([
    "של", "את", "על", "עם", "אם", "אל", "מן", "זה", "זו", "זאת", "אלה", "אלו",
    "אני", "אתה", "את", "הוא", "היא", "אנחנו", "אתם", "אתן", "הם", "הן",
    "לא", "כן", "אין", "יש", "רק", "כל", "מה", "מי", "איך", "כיצד", "למה", "מדוע",
    "קרחת", "קדחת", "כלב", "חלב", "חבר", "חרב", "בית", "זית", "ספר", "סיר", "סרט",
    "שמש", "ירח", "שקט", "שבט", "בוקר", "מוקר", "ערב", "לילה", "איש", "אישה", "ילד", "ילדה",
    "ראש", "פנים", "עין", "אוזן", "פה", "יד", "רגל", "לב", "גוף", "דם", "עור", "שיער",
    "דלת", "חלון", "חדר", "שולחן", "כיסא", "אוכל", "לחם", "מים", "אש", "כסף", "דרך", "מקום"
]);

const CLIENT_HOMOPHONES = [
    new Set(["ט", "ת"]),
    new Set(["כ", "ק"]),
    new Set(["א", "ע", "ה"]),
    new Set(["ח", "כ"]),
    new Set(["ס", "ש"]),
    new Set(["ב", "ו"])
];

const CLIENT_FINAL_MAP = { "ם": "מ", "ן": "נ", "ץ": "צ", "ף": "פ", "ך": "כ" };
const CLIENT_MATRES = new Set(["י", "ו", "א", "ה"]);

function normalizeClientChar(c) {
    return CLIENT_FINAL_MAP[c] || c;
}

function areClientHomophones(c1, c2) {
    const n1 = normalizeClientChar(c1);
    const n2 = normalizeClientChar(c2);
    if (n1 === n2) return true;
    for (const group of CLIENT_HOMOPHONES) {
        if (group.has(n1) && group.has(n2)) return true;
    }
    return false;
}

function validateClientTypo(wrong, correct) {
    const w = (wrong || "").trim().toLowerCase();
    const c = (correct || "").trim().toLowerCase();

    if (w === c) {
        return { valid: false, reason: "המילה השגויה והתיקון זהים לחלוטין." };
    }

    if (CLIENT_RESERVED_WORDS.has(w)) {
        return {
            valid: false,
            reason: `המילה "${w}" היא מילה תקנית ועצמאית בעברית ולא ניתן להחליפה כשגיאת כתיב (החלפתה תשבש כתוביות שבהן המילה נאמרה בכוונה).`
        };
    }

    const cleanRegex = /[\s\-_'"״׳]/g;
    const wClean = w.replace(cleanRegex, "").split("").map(normalizeClientChar).join("");
    const cClean = c.replace(cleanRegex, "").split("").map(normalizeClientChar).join("");

    if (!wClean || !cClean) {
        return { valid: false, reason: "נא להזין מילים תקינות בעברית." };
    }

    // Spacing / punctuation
    if (wClean === cClean) return { valid: true };

    // Transliteration variants (e.g. צ <-> טס / תס)
    const wTrans = wClean.replace(/טס/g, "צ").replace(/תס/g, "צ");
    const cTrans = cClean.replace(/טס/g, "צ").replace(/תס/g, "צ");
    if (wTrans === cTrans) return { valid: true };

    // Phonetic alignment
    const n = wClean.length;
    const m = cClean.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] + (CLIENT_MATRES.has(wClean[i - 1]) ? 1 : 10);
    for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + (CLIENT_MATRES.has(cClean[j - 1]) ? 1 : 10);

    for (let i = 1; i <= n; i++) {
        const ch1 = wClean[i - 1];
        for (let j = 1; j <= m; j++) {
            const ch2 = cClean[j - 1];
            let subCost = (ch1 === ch2) ? 0 : (areClientHomophones(ch1, ch2) ? 1 : 10);
            let delCost = CLIENT_MATRES.has(ch1) ? 1 : 10;
            let insCost = CLIENT_MATRES.has(ch2) ? 1 : 10;

            dp[i][j] = Math.min(
                dp[i - 1][j - 1] + subCost,
                dp[i - 1][j] + delCost,
                dp[i][j - 1] + insCost
            );
        }
    }

    const dist = dp[n][m];
    const maxAllowed = Math.max(n, m) >= 6 ? 3 : 2;

    if (dist <= maxAllowed) return { valid: true };

    return {
        valid: false,
        reason: `המילים "${w}" ו-"${c}" אינן דומות בצליל ואינן שגיאת כתיב פונטית (אותיות כמו ר' ו-ד' נשמעות שונה לחלוטין). מערכת התיקון נועדה לשגיאות כתיב בלבד (כגון ט/ת, ק/כ, א/ע, רווחים או תעתיק).`
    };
}

// -----------------------------------------------------------------------------
// Typo Report & Suggestion Handler
// -----------------------------------------------------------------------------
function handleSuggestSubmit(event) {
    event.preventDefault();
    const wrongInput = document.getElementById("wrongWord");
    const correctInput = document.getElementById("correctWord");
    const exampleInput = document.getElementById("exampleSentence");
    const statusBox = document.getElementById("suggestStatus");
    const submitBtn = document.getElementById("btnSubmitSuggest");

    const wrongWord = (wrongInput ? wrongInput.value : "").trim();
    const correctWord = (correctInput ? correctInput.value : "").trim();
    const example = (exampleInput ? exampleInput.value : "").trim();

    if (!wrongWord || !correctWord) return;

    // Client-side linguistic guard
    const clientCheck = validateClientTypo(wrongWord, correctWord);
    if (!clientCheck.valid) {
        if (statusBox) {
            statusBox.className = "suggest-status error";
            statusBox.style.display = "block";
            statusBox.innerHTML = `
                <strong>שימו לב:</strong> ${clientCheck.reason}<br>
                <span style="font-size: 0.85rem; opacity: 0.85;">נא לוודא שמדובר בשגיאת כתיב או תעתיק עברית אמיתית, ולא בשתי מילים שונות.</span>
            `;
        }
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>שולח למערכת...</span>";

    // Store in localStorage for user session history
    try {
        const stored = JSON.parse(localStorage.getItem("cs_trim_typo_suggestions") || "[]");
        stored.push({
            wrong: wrongWord,
            correct: correctWord,
            example: example,
            date: new Date().toISOString()
        });
        localStorage.setItem("cs_trim_typo_suggestions", JSON.stringify(stored));
    } catch (e) {}

    // Prepare quick whatsapp report url
    const reportText = `דיווח שגיאת כתוביות ב-CS Trim:%0A- שגוי: ${encodeURIComponent(wrongWord)}%0A- נכון: ${encodeURIComponent(correctWord)}${example ? `%0A- הקשר: ${encodeURIComponent(example)}` : ""}`;
    const trapInput = document.getElementById("website_trap");
    const trapValue = (trapInput ? trapInput.value : "").trim();
    const whatsappUrl = `https://api.whatsapp.com/send?text=${reportText}`;

    fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            wrongWord: wrongWord,
            correctWord: correctWord,
            exampleSentence: example,
            website_trap: trapValue
        })
    })
    .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "אירעה שגיאה בקליטת המילה במערכת");
        }
        return data;
    })
    .then(data => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>שלח מילה לתיקון במערכת</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

        if (statusBox) {
            statusBox.className = "suggest-status success";
            statusBox.style.display = "block";
            statusBox.innerHTML = `
                <strong>תודה רבה! המילה נקלטה בהצלחה במערכת.</strong><br>
                ${data && data.automated ? (data.message || "התיקון פורסם באופן אוטומטי לכל המשתמשים!") : "התיקון נרשם ומתעדכן במילון הכתוביות של הפלאגין."}<br>
                <div style="margin-top: 10px;">
                    <a href="${whatsappUrl}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; color: #38bdf8; font-weight: 600; text-decoration: underline;">
                        <span>רוצה לעדכן אותנו גם בוואטסאפ? לחץ כאן לשליחה מהירה</span>
                    </a>
                </div>
            `;
        }

        if (wrongInput) wrongInput.value = "";
        if (correctInput) correctInput.value = "";
        if (exampleInput) exampleInput.value = "";
    })
    .catch(err => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>שלח מילה לתיקון במערכת</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

        if (statusBox) {
            statusBox.className = "suggest-status error";
            statusBox.style.display = "block";
            statusBox.innerHTML = `
                <strong>שימו לב:</strong> ${err.message || "הבקשה לא אושרה על ידי מערכת הסינון."}<br>
                <span style="font-size: 0.85rem; opacity: 0.85;">נא לוודא שמדובר בשגיאת כתיב או תעתיק עברית אמיתית.</span>
            `;
        }
    });
}

// =============================================================================
// 9. Lead Capture & Download Gate (איסוף לידים לפני הורדה)
// =============================================================================

// הדבק כאן את כתובת ה-Web App של Google Apps Script כשתרצה לסנכרן אוטומטית לגוגל שיטס
let GOOGLE_SHEETS_WEBHOOK_URL = ""; 

let pendingDownload = {
    url: "",
    filename: "",
    platform: ""
};

function showToast(message, duration = 4500) {
    const toast = document.getElementById("downloadToast");
    const toastText = document.getElementById("downloadToastText");
    if (!toast) return;
    if (toastText) toastText.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

function hasUserRegistered() {
    try {
        return !!localStorage.getItem("cs_trim_lead_email");
    } catch (e) {
        return false;
    }
}

function openLeadModal(targetUrl, filename, platformName) {
    pendingDownload = {
        url: targetUrl || "",
        filename: filename || "",
        platform: platformName || "Windows"
    };

    const modal = document.getElementById("leadModal");
    const badgeText = document.getElementById("leadTargetText");
    const badgeIcon = document.getElementById("leadTargetIcon");
    const emailInput = document.getElementById("leadEmailInput");
    const errorMsg = document.getElementById("leadErrorMsg");

    if (errorMsg) errorMsg.style.display = "none";
    if (badgeText) {
        if (platformName.includes("Mac") || targetUrl.includes("Mac") || targetUrl.includes(".pkg")) {
            badgeText.textContent = "עבור Mac (קובץ התקנה PKG)";
            if (badgeIcon) badgeIcon.textContent = "🍏";
        } else if (targetUrl.includes(".zip")) {
            badgeText.textContent = "עבור Windows (חבילת ZIP מלאה)";
            if (badgeIcon) badgeIcon.textContent = "📦";
        } else {
            badgeText.textContent = "עבור Windows (קובץ התקנה Setup.exe)";
            if (badgeIcon) badgeIcon.textContent = "🪟";
        }
    }

    const formView = document.getElementById("leadFormView");
    const successView = document.getElementById("leadSuccessView");
    if (formView) formView.style.display = "block";
    if (successView) successView.style.display = "none";

    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    setTimeout(() => {
        if (emailInput) {
            emailInput.focus();
        }
    }, 150);
}

function closeLeadModal(e) {
    if (e && e.target && e.target !== e.currentTarget && !e.target.classList.contains("lead-modal-close-btn")) {
        return;
    }
    const modal = document.getElementById("leadModal");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
}

function triggerFileDownload(url, filename) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
    }, 100);
}

function recordLeadLocally(leadData) {
    try {
        const stored = JSON.parse(localStorage.getItem("cs_trim_leads_cache") || "[]");
        stored.push(leadData);
        localStorage.setItem("cs_trim_leads_cache", JSON.stringify(stored));
    } catch (e) {
        console.warn("Could not save to localStorage cache", e);
    }
}

// כלי עזר: הצגת כל הלידים שנאספו בקונסול
window.getCSLeads = function() {
    try {
        const leads = JSON.parse(localStorage.getItem("cs_trim_leads_cache") || "[]");
        console.table(leads);
        return leads;
    } catch (e) {
        return [];
    }
};

// כלי עזר: איפוס הרשמה מקומית לצורך בדיקות
window.resetLeadGate = function() {
    localStorage.removeItem("cs_trim_lead_email");
    console.log("Lead gate reset successfully! Next download will prompt for email.");
};

async function handleLeadSubmit(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById("leadEmailInput");
    const errorMsg = document.getElementById("leadErrorMsg");
    const submitBtn = document.getElementById("btnLeadSubmit");

    const consent = document.getElementById("leadConsentCheckbox");

    const email = (emailInput ? emailInput.value : "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
        if (errorMsg) {
            errorMsg.textContent = "נא להזין כתובת אימייל תקינה";
            errorMsg.style.display = "block";
        }
        if (emailInput) emailInput.focus();
        return;
    }

    if (consent && !consent.checked) {
        if (errorMsg) {
            errorMsg.textContent = "נא לסמן את תיבת האישור כדי להמשיך";
            errorMsg.style.display = "block";
        }
        return;
    }

    if (errorMsg) errorMsg.style.display = "none";

    // כפתור למצב טעינה
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>מאמת ושומר אימייל...</span><span style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;"></span>`;
    }

    const leadData = {
        email: email,
        platform: pendingDownload.platform || "Windows",
        fileName: pendingDownload.filename || pendingDownload.url,
        timestamp: new Date().toISOString(),
        dateFormatted: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
        referrer: document.referrer || "direct"
    };

    // שמירה ב-localStorage
    try {
        localStorage.setItem("cs_trim_lead_email", email);
    } catch (err) {}
    recordLeadLocally(leadData);

    // שליחה לגוגל שיטס (אם מוגדר קישור Webhook)
    if (GOOGLE_SHEETS_WEBHOOK_URL && GOOGLE_SHEETS_WEBHOOK_URL.trim() !== "") {
        try {
            fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(leadData)
            }).catch(err => console.warn("Google Sheets dispatch note:", err));
        } catch (err) {
            console.warn("Could not dispatch webhook:", err);
        }
    }

    // מעבר למסך אישור
    setTimeout(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>המשך להורדה חינם</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
        }

        const confirmedEmailEl = document.getElementById("leadConfirmedEmail");
        if (confirmedEmailEl) confirmedEmailEl.textContent = email;

        const manualBtn = document.getElementById("btnManualDownload");
        if (manualBtn) {
            manualBtn.onclick = function() {
                triggerFileDownload(pendingDownload.url, pendingDownload.filename);
            };
        }

        const formView = document.getElementById("leadFormView");
        const successView = document.getElementById("leadSuccessView");
        if (formView) formView.style.display = "none";
        if (successView) successView.style.display = "block";

        if (pendingDownload.url) {
            triggerFileDownload(pendingDownload.url, pendingDownload.filename);
            showToast("תודה! האימייל אושר והקובץ מתחיל לרדת כעת 🚀");
        }
    }, 500);
}

// יירוט כל כפתורי ההורדה באתר
window.handleDownloadLinkClick = function(e, element) {
    if (!element) return true;
    const url = element.getAttribute("href") || "";
    const filename = element.getAttribute("download") || "";
    let platformName = "Windows";
    if (url.includes("Mac") || url.includes(".pkg")) {
        platformName = "Mac";
    } else if (url.includes(".zip")) {
        platformName = "Windows ZIP";
    }

    // אם המשתמש כבר נרשם בעבר במחשב זה - ההורדה ממשיכה מיידית
    if (hasUserRegistered()) {
        showToast("מוריד את CS Trim... תהנה מהעריכה!");
        return true;
    }

    // מניעת הורדה ישירה ופתיחת הפופ-אפ
    if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    openLeadModal(url, filename, platformName);
    return false;
};

// כפתור הורדה עליון ב-Navbar
window.handleNavDownloadClick = function(e) {
    if (hasUserRegistered()) {
        return true; // ממשיך בגלילה רגילה ל-#download
    }
    if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    }
    const os = (typeof detectUserOS === "function") ? detectUserOS() : "win";
    const isMac = (os === "mac");
    const url = isMac 
        ? "download/CS-Trim-v1.0.0-Mac.pkg?v=1.0.5" 
        : "download/CS-Trim-Setup.exe?v=1.0.5";
    const filename = isMac ? "CS-Trim-v1.0.0-Mac.pkg" : "CS-Trim-Setup.exe";
    openLeadModal(url, filename, isMac ? "Mac" : "Windows");
    return false;
};

window.openLeadModal = openLeadModal;
window.closeLeadModal = closeLeadModal;
window.handleLeadSubmit = handleLeadSubmit;

function setupDownloadGating() {
    // 1. האזנה גלובלית לכל לחיצה על קישור המכיל download/
    document.addEventListener("click", function(e) {
        const link = e.target.closest('a[href*="download/"], #btnHeroDownloadMac, #btnHeroDownloadWin, #btnCardDownloadMac, #btnCardDownloadWin');
        if (!link) return;
        window.handleDownloadLinkClick(e, link);
    }, true);
}

// הפעלה מיידית של מנגנון היירוט
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDownloadGating);
} else {
    setupDownloadGating();
}

// סגירה במקש Escape
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        closeLeadModal();
    }
});
