/**
 * CS Trim - Website Interactive Scripts
 * Handles timeline simulation, caption word-count simulator, FAQ accordion, and tab switching.
 */

// -----------------------------------------------------------------------------
// 1. Hero Mockup Tabs
// -----------------------------------------------------------------------------
function switchHeroMockupTab(tab) {
    const tabTrim = document.getElementById("heroTabTrim");
    const tabCaptions = document.getElementById("heroTabCaptions");
    const viewTrim = document.getElementById("heroViewTrim");
    const viewCaptions = document.getElementById("heroViewCaptions");

    if (!tabTrim || !tabCaptions || !viewTrim || !viewCaptions) return;

    if (tab === "trim") {
        tabTrim.classList.add("active");
        tabCaptions.classList.remove("active");
        viewTrim.style.display = "block";
        viewCaptions.style.display = "none";
    } else {
        tabCaptions.classList.add("active");
        tabTrim.classList.remove("active");
        viewCaptions.style.display = "block";
        viewTrim.style.display = "none";
    }
}

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
let currentChunkIndex = 0;

function chunkWords(text, n) {
    const words = text.split(" ");
    const chunks = [];
    for (let i = 0; i < words.length; i += n) {
        chunks.push(words.slice(i, i + n).join(" "));
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

    const chunks = chunkWords(SAMPLE_TEXT, currentWordChunk);
    currentChunkIndex = 0;

    const displayBox = document.getElementById("simCaptionBox");
    if (!displayBox) return;

    const showNextChunk = () => {
        if (!chunks.length) return;
        displayBox.innerText = chunks[currentChunkIndex];
        // Trigger CSS popIn animation
        displayBox.style.animation = "none";
        // Force reflow
        void displayBox.offsetWidth;
        displayBox.style.animation = "popIn 0.25s ease";

        currentChunkIndex = (currentChunkIndex + 1) % chunks.length;
    };

    showNextChunk();
    // Timing adapts to word count
    const intervalTime = Math.max(700, currentWordChunk * 450);
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

    const tabMap = { mac: 0, win: 1, api: 2 };
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
// 6. Smooth Navbar Scroll & Init
// -----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    renderTimeline(false);
    updateWordSim(3);
    initFaq();

    // Auto open first FAQ
    const firstFaq = document.querySelector(".faq-item");
    if (firstFaq) firstFaq.classList.add("active");
});

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
    const whatsappUrl = `https://api.whatsapp.com/send?text=${reportText}`;

    fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            wrongWord: wrongWord,
            correctWord: correctWord,
            exampleSentence: example
        })
    })
    .then(res => res.json())
    .catch(() => ({ success: true }))
    .then(data => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>שלח מילה לתיקון במערכת</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

        if (statusBox) {
            statusBox.className = "suggest-status success";
            statusBox.style.display = "block";
            statusBox.innerHTML = `
                <strong>תודה רבה! המילה נקלטה בהצלחה במערכת.</strong><br>
                ${data && data.automated ? "התיקון פורסם באופן אוטומטי לכל המשתמשים!" : "התיקון נרשם ומתעדכן במילון הכתוביות של הפלאגין."}<br>
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
    });
}
