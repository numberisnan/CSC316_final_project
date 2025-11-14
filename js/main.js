// main.js (robust loader)
(async function () {
    async function loadCSV() {
        try {
            return await d3.csv("data/cleaned_data.csv", d3.autoType);
        } catch (e1) {
            try {
                return await d3.csv("cleaned_data.csv", d3.autoType);
            } catch (e2) {
                console.error("Failed to load CSV from both paths", e1, e2);
                return [];
            }
        }
    }

    const data = await loadCSV();

    // setup controls
    setupControls(data);

    window.__FULL_ROWS__ = data;

    window.applyTriangleSelection = function (subset) {
        const rows = subset && subset.length ? subset : window.__FULL_ROWS__;
        if (window.renderGarden) window.renderGarden(rows);
    };

    if (window.renderTriangle) window.renderTriangle(data);
    if (window.renderGarden) window.renderGarden(data);
    if (window.renderSleepOrbit) window.renderSleepOrbit(data);
    if (window.renderAvatar) window.renderAvatar(data);
    if (window.renderClassroom) window.renderClassroom(data);

    // --- enhancements: filters + simple simulator ---
    function firstKey(rows, options) {
        // Return the first key that exists in at least one row
        for (const k of options) {
            const hit = rows.find(r => r[k] != null && r[k] !== "");
            if (hit) return k;
        }
        return null;
    }
    function uniq(arr) { return Array.from(new Set(arr.filter(v => v != null && v !== ""))); }
    function populateSelect(sel, values) {
        const el = document.getElementById(sel);
        if (!el) return;
        const opts = uniq(values).sort((a, b) => ('' + a).localeCompare('' + b));
        for (const v of opts) { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); }
    }
    function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }

    function setupControls(rows) {
        const yearKey = firstKey(rows, ["year", "Year", "student_year", "academic_year", "Year_Level", "Year of Study"]);
        const majorKey = firstKey(rows, ["major", "Major", "program", "Program", "field", "Department"]);
        const genderKey = firstKey(rows, ["gender", "Gender", "sex", "Sex"]);

        // store keys for reuse
        window.__FILTER_KEYS__ = { yearKey, majorKey, genderKey };

        // populate dropdowns
        if (yearKey) populateSelect("fYear", rows.map(r => r[yearKey]));
        if (majorKey) populateSelect("fMajor", rows.map(r => r[majorKey]));
        if (genderKey) populateSelect("fGender", rows.map(r => r[genderKey]));

        // attach handlers
        ["fYear", "fMajor", "fGender"].forEach(id => {
            const el = document.getElementById(id); if (!el) return;
            el.onchange = applyFiltersAndRender;
        });
        const clearBtn = document.getElementById("clearFilters");
        if (clearBtn) {
            clearBtn.onclick = () => {
                ["fYear", "fMajor", "fGender"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
                applyFiltersAndRender();
            };
        }

        // simulator: populate coping list from garden grouping aliases
        const copingKey = firstKey(rows, ["coping", "coping_strategy", "what_coping_strategy_you_use_as_a_student?"]);
        const simC = document.getElementById("simCoping");
        if (simC && copingKey) {
            uniq(rows.map(r => r[copingKey])).sort((a, b) => ('' + a).localeCompare('' + b)).forEach(v => {
                const o = document.createElement('option'); o.value = v; o.textContent = v; simC.appendChild(o);
            });
        }
        // simple prototype model: learn two coefficients from data if present
        const sleepKey = firstKey(rows, ["sleep_hours", "sleep", "sleep_duration", "avg_sleep_hours"]);
        const exKey = firstKey(rows, ["avg_exercise", "exercise_hours", "exercise_hours_per_week", "exercise"]);
        const stressKey = firstKey(rows, ["avg_stress", "stress_score", "stress_level", "rate_your_academic_stress_index"]);

        function predict(sleep, ex, coping) {
            // baseline and learned slopes (very rough, robust to missing keys)
            let b0 = 6.0, bSleep = -0.35, bEx = -0.12, bC = 0.0;
            try {
                if (sleepKey && exKey && stressKey) {
                    // quick-and-dirty regressions (no intercept fitting; safe defaults)
                    const rows2 = rows.filter(r => isFinite(+r[stressKey]));
                    const S = rows2.map(r => +r[stressKey]);
                    const Xs = rows2.map(r => +r[exKey]).filter(isFinite);
                    const Zs = sleepKey ? rows2.map(r => +r[sleepKey]).filter(isFinite) : [];
                    if (Xs.length > 30) {
                        const mx = Xs.reduce((a, b) => a + b, 0) / Xs.length;
                        const my = S.slice(0, Xs.length).reduce((a, b) => a + b, 0) / Xs.length;
                        const num = Xs.reduce((acc, x, i) => acc + (x - mx) * (S[i] - my), 0);
                        const den = Xs.reduce((acc, x) => acc + (x - mx) * (x - mx), 0) || 1;
                        bEx = (den ? num / den : bEx) * 0.5; // dampen
                        b0 = my - bEx * mx;
                    }
                    if (Zs.length > 30) {
                        const mz = Zs.reduce((a, b) => a + b, 0) / Zs.length;
                        const my = S.slice(0, Zs.length).reduce((a, b) => a + b, 0) / Zs.length;
                        const num = Zs.reduce((acc, z, i) => acc + (z - mz) * (S[i] - my), 0);
                        const den = Zs.reduce((acc, z) => acc + (z - mz) * (z - mz), 0) || 1;
                        bSleep = (den ? num / den : bSleep) * 0.5; // dampen
                        b0 = (b0 + (my - bSleep * mz)) / 2;
                    }
                }
            } catch (e) { /* keep defaults */ }

            // crude coping bonus: look at average stress by coping and compare to grand mean
            if (stressKey) {
                const copingKey = firstKey(rows, ["coping", "coping_strategy", "what_coping_strategy_you_use_as_a_student?"]);
                if (copingKey && coping) {
                    const rowsC = rows.filter(r => r[copingKey] === coping && isFinite(+r[stressKey]));
                    const rowsAll = rows.filter(r => isFinite(+r[stressKey]));
                    if (rowsC.length && rowsAll.length) {
                        const meanC = rowsC.reduce((a, b) => a + +b[stressKey], 0) / rowsC.length;
                        const meanAll = rowsAll.reduce((a, b) => a + +b[stressKey], 0) / rowsAll.length;
                        bC = (meanC - meanAll); // if lower than average => negative (good)
                    }
                }
            }

            let pred = b0 + bSleep * (sleep || 0) + bEx * (ex || 0) + bC;
            pred = Math.max(0, Math.min(10, pred));
            return pred;
        }

        function updateSim() {
            const sleep = parseFloat(document.getElementById("simSleep")?.value || "7.5");
            const ex = parseFloat(document.getElementById("simEx")?.value || "3");
            const coping = document.getElementById("simCoping")?.value || "";
            const out = document.getElementById("simOut");
            const ps = predict(sleep, ex, coping);
            if (out) out.textContent = "Predicted stress: " + ps.toFixed(2);
            const s1 = document.getElementById("simSleepVal"); if (s1) s1.textContent = sleep;
            const s2 = document.getElementById("simExVal"); if (s2) s2.textContent = ex;
        }
        ["simSleep", "simEx", "simCoping"].forEach(id => {
            const el = document.getElementById(id); if (el) el.oninput = updateSim;
        });
        updateSim();
    }

    function applyFiltersAndRender() {
        const rows = window.__FULL_ROWS__ || [];
        const { yearKey, majorKey, genderKey } = window.__FILTER_KEYS__ || {};
        const fy = getVal("fYear"), fm = getVal("fMajor"), fg = getVal("fGender");
        const subset = rows.filter(r =>
            (!fy || r[yearKey] == fy) &&
            (!fm || r[majorKey] == fm) &&
            (!fg || r[genderKey] == fg)
        );
        if (window.renderTriangle) window.renderTriangle(subset);
        if (window.renderGarden) window.renderGarden(subset);
        if (window.updateClassroom) window.updateClassroom(subset);
    }
    // --- end enhancements ---

})();