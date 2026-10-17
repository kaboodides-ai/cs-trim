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

    let clips = container.querySelectorAll(".sim-clip");

    // Populate track elements if not already present
    if (clips.length !== TIMELINE_DATA.length) {
        container.innerHTML = "";
        TIMELINE_DATA.forEach((item) => {
            const clipEl = document.createElement("div");
            clipEl.className = `sim-clip ${item.type === "speech" ? "sim-clip-speech" : "sim-clip-silence"}`;
            if (item.type === "speech") {
                clipEl.innerText = item.label;
            } else {
                clipEl.title = "שקט (נחתך אוטומטית)";
                clipEl.innerHTML = `<span class="sim-silence-tag">✂️ שקט</span>`;
            }
            container.appendChild(clipEl);
        });
        clips = container.querySelectorAll(".sim-clip");
    }

    // Smoothly animate existing elements without destroying DOM
    TIMELINE_DATA.forEach((item, index) => {
        const clipEl = clips[index];
        if (!clipEl) return;

        if (item.type === "speech") {
            clipEl.style.flex = isCut ? `${item.width * 1.5}` : `${item.width}`;
            clipEl.style.opacity = "1";
        } else {
            if (isCut) {
                clipEl.style.flex = "0 0 0px";
                clipEl.style.width = "0px";
                clipEl.style.minWidth = "0px";
                clipEl.style.maxWidth = "0px";
                clipEl.style.padding = "0px";
                clipEl.style.margin = "0px";
                clipEl.style.borderWidth = "0px";
                clipEl.style.opacity = "0";
                clipEl.style.overflow = "hidden";
                clipEl.style.pointerEvents = "none";
            } else {
                clipEl.style.flex = `${item.width}`;
                clipEl.style.width = "";
                clipEl.style.minWidth = "";
                clipEl.style.maxWidth = "";
                clipEl.style.padding = "";
                clipEl.style.margin = "";
                clipEl.style.borderWidth = "";
                clipEl.style.opacity = "1";
                clipEl.style.overflow = "hidden";
                clipEl.style.pointerEvents = "auto";
            }
        }
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
    if (btn) {
        btn.classList.add("active");
    } else {
        const match = Array.from(btns).find(b => {
            const attr = b.getAttribute("onclick") || "";
            return attr.includes(color);
        });
        if (match) match.classList.add("active");
    }
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
    currentWordChunk = parseInt(wordsPerCaption, 10) || 3;
    const label = document.getElementById("simWordsLabel");
    if (label) {
        label.innerText = `${currentWordChunk} ${currentWordChunk === 1 ? "מילה" : "מילים"}`;
    }

    // Update active preset button highlight (handles digit and Hebrew text)
    const presets = document.querySelectorAll(".preset-pill");
    presets.forEach(p => p.classList.remove("active"));
    const matchingPreset = Array.from(presets).find(p => {
        const wordsAttr = p.getAttribute("data-words");
        if (wordsAttr) return wordsAttr === String(currentWordChunk);
        if (currentWordChunk === 1 && (p.textContent.includes("אחת") || p.textContent.includes("1"))) return true;
        return p.textContent.includes(String(currentWordChunk));
    });
    if (matchingPreset) matchingPreset.classList.add("active");

    const slider = document.getElementById("interactiveWordSlider");
    if (slider && String(slider.value) !== String(currentWordChunk)) {
        slider.value = currentWordChunk;
    }

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

    // Reactively tint border and glow to match the selected highlight color
    if (simHighlightColor === "none") {
        displayBox.style.borderColor = "rgba(255, 255, 255, 0.2)";
        displayBox.style.boxShadow = "none";
    } else {
        displayBox.style.borderColor = simHighlightColor;
        displayBox.style.boxShadow = `0 0 16px ${simHighlightColor}44`;
    }

    const renderWords = (chunk, activeIdx) => {
        const existingSpans = displayBox.querySelectorAll(".sim-word");
        if (existingSpans.length === chunk.length) {
            existingSpans.forEach((span, wIdx) => {
                span.textContent = chunk[wIdx];
                if (simHighlightColor !== "none" && wIdx === activeIdx) {
                    span.classList.add("sim-highlighted-word");
                    span.style.backgroundColor = simHighlightColor;
                } else {
                    span.classList.remove("sim-highlighted-word");
                    span.style.backgroundColor = "";
                }
            });
            return;
        }

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

    if (!isWin && typeof switchGuideTab === "function") {
        switchGuideTab("mac");
    }
}

// -----------------------------------------------------------------------------
// 7. Smooth Navbar Scroll & Init
// -----------------------------------------------------------------------------
function initAll() {
    if (typeof initOSDetection === "function") initOSDetection();
    renderTimeline(false);
    updateWordSim(3);
    initFaq();

    // Auto open first FAQ
    const firstFaq = document.querySelector(".faq-item");
    if (firstFaq) firstFaq.classList.add("active");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
} else {
    initAll();
}

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

    // Send typo suggestion to Google Sheets as well
    var sheetsDirectUrl = "https://script.google.com/macros/s/AKfycbxKrwUzhMHd4k9sztgsB3zn6GCW5hgNa39R1P8Dj7Vic-pmlVc2kcDuCxTqzilraTSNeQ/exec";
    try {
        fetch(sheetsDirectUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "typo",
                typeLabel: "✍️ שגיאת כתוביות",
                message: "מילה שגויה: " + wrongWord + " ➔ תיקון רצוי: " + correctWord + (example ? " (הקשר: " + example + ")" : ""),
                contact: "משתמש באתר",
                source: "website",
                platform: (typeof navigator !== "undefined" && navigator.platform) ? navigator.platform : "Web",
                version: "1.0.5"
            })
        }).catch(function() {});
    } catch (eSheets) {}

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

// -----------------------------------------------------------------------------
// Community Section Tab Switcher (Feedback / Typo Reporting)
// -----------------------------------------------------------------------------
function switchCommunityTab(tabName, btn) {
    var feedbackPane = document.getElementById("paneFeedback");
    var typoPane = document.getElementById("paneTypo");
    var btns = document.querySelectorAll(".com-tab-btn");
    btns.forEach(function(b) { b.classList.remove("active"); });

    if (btn) btn.classList.add("active");

    if (tabName === "feedback") {
        if (feedbackPane) feedbackPane.style.display = "block";
        if (typoPane) typoPane.style.display = "none";
    } else {
        if (feedbackPane) feedbackPane.style.display = "none";
        if (typoPane) typoPane.style.display = "block";
    }
}

function updateWebFbTypePill(radio) {
    var pills = document.querySelectorAll(".web-fb-pill");
    pills.forEach(function(p) { p.classList.remove("active"); });
    if (radio && radio.parentElement) {
        radio.parentElement.classList.add("active");
    }
}

function handleFeedbackSubmit(event) {
    event.preventDefault();
    var msgInput = document.getElementById("webFbMessage");
    var contactInput = document.getElementById("webFbContact");
    var trapInput = document.getElementById("feedback_trap");
    var statusBox = document.getElementById("webFeedbackStatus");
    var submitBtn = document.getElementById("btnSubmitFeedbackWeb");

    var message = (msgInput ? msgInput.value : "").trim();
    var contact = (contactInput ? contactInput.value : "").trim();
    var trap = (trapInput ? trapInput.value : "").trim();
    var typeRadio = document.querySelector('input[name="webFbType"]:checked');
    var type = typeRadio ? typeRadio.value : "improvement";

    if (!message || message.length < 3) {
        if (statusBox) {
            statusBox.className = "suggest-status error";
            statusBox.style.display = "block";
            statusBox.textContent = "נא לכתוב פידבק או תיאור של לפחות מספר מילים";
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>שולח פידבק...</span>";
    }

    var payload = {
        type: type,
        message: message,
        contact: contact,
        source: "website",
        platform: (typeof navigator !== "undefined" && navigator.platform) ? navigator.platform : "Web",
        version: "1.0.5",
        website_trap: trap
    };

    // Save to localStorage
    try {
        var stored = JSON.parse(localStorage.getItem("cs_trim_feedbacks_cache") || "[]");
        stored.push(Object.assign({}, payload, { timestamp: new Date().toISOString() }));
        localStorage.setItem("cs_trim_feedbacks_cache", JSON.stringify(stored));
    } catch (e) {}

    // Direct Google Sheets Webhook dispatch
    var sheetsDirectUrl = "https://script.google.com/macros/s/AKfycbxKrwUzhMHd4k9sztgsB3zn6GCW5hgNa39R1P8Dj7Vic-pmlVc2kcDuCxTqzilraTSNeQ/exec";
    try {
        fetch(sheetsDirectUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(function() {});
    } catch (eSheets) {}

    fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(async function(res) {
        var data = await res.json().catch(function() { return {}; });
        if (!res.ok) {
            throw new Error(data.error || "אירעה שגיאה בשמירת הפידבק");
        }
        return data;
    })
    .then(function(data) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>שלח פידבק למפתחים</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        }
        if (statusBox) {
            statusBox.className = "suggest-status success";
            statusBox.style.display = "block";
            statusBox.innerHTML = `
                <strong>תודה רבה! הפידבק שלך נשמר בהצלחה.</strong><br>
                ההצעה נרשמה ונכנסת ישירות לפיתוח הגרסה הבאה של התוסף.<br>
                ${data.whatsappUrl ? `
                <div style="margin-top: 10px;">
                    <a href="${data.whatsappUrl}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; color: #38bdf8; font-weight: 600; text-decoration: underline;">
                        <span>רוצה לעדכן אותנו גם ישירות בוואטסאפ? לחץ כאן לשליחה מהירה</span>
                    </a>
                </div>` : ""}
            `;
        }
        if (msgInput) msgInput.value = "";
        if (contactInput) contactInput.value = "";
    })
    .catch(function(err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>שלח פידבק למפתחים</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        }
        if (statusBox) {
            statusBox.className = "suggest-status error";
            statusBox.style.display = "block";
            statusBox.innerHTML = `<strong>שים לב:</strong> ${err.message || "אירעה שגיאה בעת שליחת הפידבק"}`;
        }
    });
}

// כלי עזר: הצגת כל הפידבקים שנשמרו בדפדפן
window.getCSFeedbacks = function() {
    try {
        var items = JSON.parse(localStorage.getItem("cs_trim_feedbacks_cache") || "[]");
        console.table(items);
        return items;
    } catch (e) {
        return [];
    }
};

// סגירה במקש Escape
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && typeof window.closeLeadModal === "function") {
        window.closeLeadModal();
    }
});

// Explicitly expose all interactive simulator & UI functions to window
if (typeof window !== "undefined") {
    window.setSimCutMode = setSimCutMode;
    window.toggleSimCut = toggleSimCut;
    window.renderTimeline = renderTimeline;
    window.updateWordSim = updateWordSim;
    window.setWordSimPreset = setWordSimPreset;
    window.setSimHighlightColor = setSimHighlightColor;
    window.startCaptionLoop = startCaptionLoop;
    window.switchGuideTab = switchGuideTab;
    window.openGuideModal = openGuideModal;
    window.closeGuideModal = closeGuideModal;
    window.handleSuggestSubmit = handleSuggestSubmit;
    window.handleFeedbackSubmit = handleFeedbackSubmit;
    window.switchCommunityTab = switchCommunityTab;
    window.updateWebFbTypePill = updateWebFbTypePill;
    window.initFaq = initFaq;
    window.initAll = initAll;
}
