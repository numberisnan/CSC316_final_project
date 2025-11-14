// js/radar_avatars.js — Panel F: Walking stick figures + hover spider chart + layout toolbar
// Toolbar: Roam | Sleep | Exercise | Severity

(function () {
    let _ro, sim, svg, gNodes, gOverlay, toolbarEl;
    let currentMode = "roam";

    // ---------- utils ----------
    const clamp = (min, v, max) => Math.min(max, Math.max(min, v));
    const within = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rand = (a, b) => a + Math.random() * (b - a);
    const toNum = (x) => { const v = +x; return Number.isFinite(v) ? v : NaN; };
    const d3shuffle = d3.shuffle ? (a) => d3.shuffle(a.slice()) : (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    // ---------- schema ----------
    function firstKey(rows, candidates) {
        const head = new Set(Object.keys(rows[0] || {}));
        for (const k of candidates) if (head.has(k)) return k;
        const lower = {};
        for (const k of head) lower[k.toLowerCase()] = k;
        for (const k of candidates) {
            const hit = lower[k.toLowerCase()];
            if (hit) return hit;
        }
        return null;
    }

    function buildSchema(rows) {
        if (!rows || !rows.length) return null;
        const sleep = firstKey(rows, [
            "sleep_hours", "sleep", "sleep_duration", "avg_sleep_hours",
            "4._on_average,_how_many_hours_of_sleep_do_you_get_on_a_typical_day?",
            "how_many_hours_of_actual_sleep_did_you_get_on_an_average_for_the_past_month?_(maybe_different_from_the_number_of_hours_spent_in_bed)",
            "what_is_your_average_hours_of_sleep_per_night?"
        ]);
        const exercise = firstKey(rows, [
            "exercise_hours", "avg_exercise", "exercise_hours_per_week", "exercise", "extracurricular_activities"
        ]);
        const anxiety = firstKey(rows, [
            "anxiety_score", "anxiety", "gad7", "anxiety_level"
        ]);
        const depression = firstKey(rows, [
            "depression_score", "depression", "phq9"
        ]);
        const stress = firstKey(rows, [
            "stress_score", "stress", "rate_your_academic_stress_index", "avg_stress", "stress_level"
        ]);
        return { sleep, exercise, anxiety, depression, stress };
    }

    // ---------- normalization + mood ----------
    // norm.* are "goodness" scores in [0,1] used ONLY for color:
    // - Sleep/exercise: more = better
    // - Anxiety/depression/stress: higher scores = worse → flip so lower is better
    const norm = {
        sleep: v => clamp(0, (v ?? 0) / 9, 1),
        ex: v => clamp(0, (v ?? 0) / 12, 1),
        anx: v => clamp(0, 1 - (v ?? 0) / 10, 1),
        dep: v => clamp(0, 1 - (v ?? 0) / 10, 1),
        str: v => clamp(0, 1 - (v ?? 0) / 10, 1),
    };

    const avg = (arr) => {
        const a = arr.filter(Number.isFinite);
        return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    };

    function severity10(r, S) {
        const vals = [
            toNum(r[S.stress]),
            toNum(r[S.anxiety]),
            toNum(r[S.depression])
        ].filter(Number.isFinite);
        if (!vals.length) return 5;
        return clamp(0, avg(vals), 10); // 0..10 (worse → higher)
    }

    // Avatar color: based only on combined stress/anxiety/depression severity
    function colorByMood(r, S) {
        // green (good) → red (bad)
        const t = clamp(0, severity10(r, S) / 10, 1);
        return d3.interpolateRdYlGn(1 - t);
    }

    // Radar color: combines all 5 indices into a single well-being score.
    // High sleep/exercise (good) push toward green;
    // High anxiety/depression/stress (bad) push toward red.
    function wellbeingColor(r, S) {
        const vals = [];

        const vSleep = toNum(r[S.sleep]);
        const vEx = toNum(r[S.exercise]);
        const vAnx = toNum(r[S.anxiety]);
        const vDep = toNum(r[S.depression]);
        const vStr = toNum(r[S.stress]);

        if (Number.isFinite(vSleep)) vals.push(norm.sleep(vSleep)); // more sleep → better
        if (Number.isFinite(vEx)) vals.push(norm.ex(vEx));       // more exercise → better
        if (Number.isFinite(vAnx)) vals.push(norm.anx(vAnx));     // lower anxiety → better
        if (Number.isFinite(vDep)) vals.push(norm.dep(vDep));     // lower depression → better
        if (Number.isFinite(vStr)) vals.push(norm.str(vStr));     // lower stress → better

        const wellbeing = vals.length ? clamp(0, avg(vals), 1) : 0.5;
        // 0 → red (poor well-being), 1 → green (good well-being)
        return d3.interpolateRdYlGn(wellbeing);
    }

    // Radar radii: show *actual* values.
    // - Sleep/Exercise: higher hours → further out (good).
    // - Anxiety/Depression/Stress: higher severity → further out (bad).
    function metricsForRow(r, S) {
        const sleepV = toNum(r[S.sleep]);
        const exV = toNum(r[S.exercise]);
        const anxV = toNum(r[S.anxiety]);
        const depV = toNum(r[S.depression]);
        const strV = toNum(r[S.stress]);

        const radius = {
            sleep: v => clamp(0, (v ?? 0) / 9, 1),
            ex: v => clamp(0, (v ?? 0) / 12, 1),
            sev: v => clamp(0, (v ?? 0) / 10, 1) // generic 0–10-ish scale
        };

        return [
            { label: "Sleep (hrs)", v: radius.sleep(sleepV) },
            { label: "Exercise (hrs/wk)", v: radius.ex(exV) },
            { label: "Anxiety", v: radius.sev(anxV) },
            { label: "Depression", v: radius.sev(depV) },
            { label: "Stress", v: radius.sev(strV) },
        ];
    }

    // ---------- panel sizing (lock height) ----------
    function lockPanel(containerSel) {
        const el = document.querySelector(containerSel);
        if (!el) return { width: 800, height: 520 };
        const minH = 520;
        const lockedHeight = Math.max(minH, el.clientHeight || minH);
        el.style.position = el.style.position || "relative";
        el.style.overflow = "hidden";
        el.style.height = lockedHeight + "px";
        const width = el.clientWidth || (el.parentElement?.clientWidth ?? 800);
        return { width, height: lockedHeight, lockedHeight };
    }

    // ---------- mini spider chart (bigger) ----------
    // keep overlay inside bounds
    function drawMiniRadar(gOverlay, x, y, row, S, width, height) {
        const color = wellbeingColor(row, S);
        const metrics = metricsForRow(row, S);
        const R = 90; // bigger than original 60
        const angle = d3.scaleLinear().domain([0, metrics.length]).range([0, 2 * Math.PI]);
        const radial = (v, i) => {
            const a = angle(i) - Math.PI / 2, rr = v * R;
            return [Math.cos(a) * rr, Math.sin(a) * rr];
        };
        const pathFn = d3.line()
            .x(d => d[0])
            .y(d => d[1])
            .curve(d3.curveLinearClosed);

        gOverlay.selectAll("*").remove();

        const safeX = within(x, 40, width - 40);
        const safeY = within(y, 40, height - 40);

        const grp = gOverlay.append("g")
            .attr("transform", `translate(${safeX},${safeY})`)
            .style("pointer-events", "none");

        grp.append("circle")
            .attr("r", R + 12)
            .attr("fill", "rgba(255,255,255,0.96)")
            .attr("stroke", "rgba(0,0,0,0.08)")
            .attr("stroke-width", 1.6);

        for (let i = 1; i <= 4; i++) grp.append("circle")
            .attr("r", (R / 4) * i)
            .attr("fill", "none")
            .attr("stroke", "#444")
            .attr("opacity", 0.14);

        metrics.forEach((m, i) => {
            const a = angle(i) - Math.PI / 2, xx = Math.cos(a) * R, yy = Math.sin(a) * R;
            grp.append("line")
                .attr("x1", 0).attr("y1", 0)
                .attr("x2", xx).attr("y2", yy)
                .attr("stroke", "#444")
                .attr("opacity", 0.16);
        });

        grp.append("path")
            .attr("d", pathFn(metrics.map((m, i) => radial(m.v, i))))
            .attr("fill", color).attr("fill-opacity", 0.30)
            .attr("stroke", color).attr("stroke-width", 2.2);

        metrics.forEach((m, i) => {
            const a = angle(i) - Math.PI / 2, rr = R + 16;
            grp.append("text")
                .attr("x", Math.cos(a) * rr)
                .attr("y", Math.sin(a) * rr)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", 10.5)
                .attr("fill", "#222")
                .text(m.label.split(" ")[0]);
        });
    }

    // ---------- stick figure (mood-colored) ----------
    function drawWalker(g, nodeDatum) {
        const color = nodeDatum.color;
        const strokeW = 2.4;
        const body = g.append("g")
            .attr("class", "walker")
            .attr("transform", "scale(0.92)");

        const headStrokeColor = d3.interpolateRgb(color, "#333")(0.35);
        body.append("circle")
            .attr("cx", 0)
            .attr("cy", -20)
            .attr("r", 8)
            .attr("fill", color)
            .attr("stroke", headStrokeColor)
            .attr("stroke-width", strokeW);

        body.append("line")
            .attr("x1", 0).attr("y1", -12)
            .attr("x2", 0).attr("y2", 18)
            .attr("stroke", color)
            .attr("stroke-width", strokeW)
            .attr("stroke-linecap", "round");

        // arms
        body.append("line")
            .attr("x1", 0).attr("y1", -2)
            .attr("x2", -11).attr("y2", 8)
            .attr("stroke", color)
            .attr("stroke-width", strokeW)
            .attr("stroke-linecap", "round");

        body.append("line")
            .attr("x1", 0).attr("y1", -2)
            .attr("x2", 11).attr("y2", 8)
            .attr("stroke", color)
            .attr("stroke-width", strokeW)
            .attr("stroke-linecap", "round");

        // legs
        body.append("line")
            .attr("x1", 0).attr("y1", 18)
            .attr("x2", -9).attr("y2", 30)
            .attr("stroke", color)
            .attr("stroke-width", strokeW)
            .attr("stroke-linecap", "round");

        body.append("line")
            .attr("x1", 0).attr("y1", 18)
            .attr("x2", 9).attr("y2", 30)
            .attr("stroke", color)
            .attr("stroke-width", strokeW)
            .attr("stroke-linecap", "round");
    }

    // ---------- toolbar ----------
    function ensureToolbar(containerSel) {
        const host = document.querySelector(containerSel);
        if (!host || toolbarEl) return;
        const div = document.createElement("div");
        toolbarEl = div;
        Object.assign(div.style, {
            position: "absolute", right: "12px", top: "12px", zIndex: 50,
            display: "flex", gap: "6px", background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(6px)", border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "10px", padding: "6px 8px", fontFamily: "Inter, system-ui, sans-serif"
        });
        const mk = (text, id) => {
            const b = document.createElement("button");
            b.textContent = text; b.id = id;
            Object.assign(b.style, {
                border: "none", borderRadius: "8px", padding: "6px 8px", cursor: "pointer",
                background: "#f0eadf", color: "#2b2116", fontWeight: 700
            });
            div.appendChild(b);
        };
        mk("Roam", "btn-roam"); mk("Sleep", "btn-sleep"); mk("Exercise", "btn-ex"); mk("Severity", "btn-sev");
        host.appendChild(div);
    }

    // ---------- main init/render ----------
    function init(rows) {
        const containerSel = "#radar-vis";
        const rootSel = d3.select(containerSel).html(""); // clear
        ensureToolbar(containerSel);

        const S = buildSchema(rows);
        if (!S || !S.sleep || !S.exercise || !S.anxiety || !S.depression || !S.stress) {
            rootSel.html("<div style='padding:1rem;opacity:.9'>Missing columns for avatar radar. Needed (any alias): <b>sleep</b>, <b>exercise</b>, <b>anxiety</b>, <b>depression</b>, <b>stress</b>.</div>");
            return;
        }

        const { width, height, lockedHeight } = lockPanel(containerSel);
        svg = rootSel.append("svg")
            .attr("width", width)
            .attr("height", height)
            .style("display", "block");
        gNodes = svg.append("g");
        gOverlay = svg.append("g").style("pointer-events", "none");

        // --- stick-figure legend (color → severity) ---
        (function drawLegend() {
            const PAD = 18;
            const legend = svg.append("g")
                .attr("class", "avatar-legend")
                .attr("transform", `translate(${PAD + 6},${height - 80})`);

            legend.append("text")
                .attr("x", 0)
                .attr("y", 0)
                .attr("fill", "#2b2116")
                .attr("font-size", 11)
                .attr("font-weight", 700)
                .text("Stick figure color = combined severity");

            const levels = [
                { label: "Low", t: 0.18 },
                { label: "Moderate", t: 0.50 },
                { label: "High", t: 0.85 }
            ];

            const row = legend.selectAll("g.level")
                .data(levels)
                .enter()
                .append("g")
                .attr("class", "level")
                .attr("transform", (d, i) => `translate(0,${16 + i * 18})`);

            row.append("circle")
                .attr("cx", 6)
                .attr("cy", -4)
                .attr("r", 6)
                .attr("fill", d => d3.interpolateRdYlGn(1 - d.t))
                .attr("stroke", "#333")
                .attr("stroke-width", 0.8);

            row.append("text")
                .attr("x", 18)
                .attr("y", -1)
                .attr("fill", "#2b2116")
                .attr("font-size", 10.5)
                .text(d => d.label + " severity");
        })();

        const PAD = 18, COLLIDE_R = 12, ROAM_STRENGTH = 0.06;
        const N = Math.min(rows.length, 250);
        const nodes = d3shuffle(rows).slice(0, N).map((r, i) => ({
            id: i,
            r,
            color: colorByMood(r, S),
            tx: 0,
            ty: 0,
            hovered: false,
            x: 0,
            y: 0
        }));

        const bounds = { left: PAD, right: width - PAD, top: PAD, bottom: height - PAD };
        nodes.forEach(n => {
            n.tx = rand(bounds.left, bounds.right);
            n.ty = rand(bounds.top, bounds.bottom);
            n.x = n.tx;
            n.y = n.ty;
        });

        // "Zoom" factor that controls vertical spacing in sorted layouts
        let spacingFactor = 1;

        function startRoamSim() {
            if (sim) sim.stop();
            sim = d3.forceSimulation(nodes)
                .velocityDecay(0.25)
                .force("charge", d3.forceManyBody().strength(-6))
                .force("collide", d3.forceCollide().radius(COLLIDE_R).iterations(2))
                .force("x", d3.forceX(d => d.tx).strength(ROAM_STRENGTH))
                .force("y", d3.forceY(d => d.ty).strength(ROAM_STRENGTH))
                .alpha(1).alphaDecay(0.02)
                .on("tick", () => {
                    if (currentMode !== "roam") return;
                    gNodes.selectAll("g.avatar").attr("transform", d => {
                        d.x = within(d.x ?? width / 2, bounds.left, bounds.right);
                        d.y = within(d.y ?? height / 2, bounds.top, bounds.bottom);
                        const s = d.hovered ? 1.25 : 1;
                        return `translate(${d.x},${d.y}) scale(${s})`;
                    });
                });
        }

        function setHover(activeId = null) {
            nodes.forEach(n => { n.hovered = (activeId !== null && n.id === activeId); });

            gNodes.selectAll("g.avatar")
                .transition().duration(180)
                .style("opacity", d => (activeId === null || d.id === activeId) ? 1 : 0.15)
                .attr("transform", d => {
                    const s = d.hovered ? 1.25 : 1;
                    return `translate(${d.x},${d.y}) scale(${s})`;
                });

            if (currentMode === "roam" && sim) {
                sim.alpha(0.3).restart();
            }
        }

        gNodes.selectAll("g.avatar")
            .data(nodes, d => d.id)
            .join(enter => {
                const gEnter = enter.append("g")
                    .attr("class", "avatar")
                    .style("cursor", "pointer");

                gEnter.each(function (d) {
                    drawWalker(d3.select(this), d);
                });

                gEnter
                    .on("mouseenter", (e, d) => {
                        setHover(d.id);
                        gOverlay.selectAll("*").remove();
                        // pass width/height so radar has bounds
                        drawMiniRadar(
                            gOverlay,
                            d.x ?? width / 2,
                            d.y ?? height / 2,
                            d.r,
                            S,
                            width,
                            height
                        );
                    })
                    .on("mouseleave", () => {
                        setHover(null);
                        gOverlay.selectAll("*").remove();
                    });

                return gEnter;
            });

        // subtle target jitter in Roam mode
        d3.interval(() => {
            if (currentMode !== "roam" || !sim) return;
            nodes.forEach(n => {
                if (Math.random() < 0.5) {
                    const j = 90;
                    n.tx = within(n.tx + rand(-j, j), bounds.left, bounds.right);
                    n.ty = within(n.ty + rand(-j, j), bounds.top, bounds.bottom);
                }
            });
            sim.alphaTarget(0.6).restart();
            setTimeout(() => sim.alphaTarget(0), 350);
        }, 3000);

        // responsive width (height locked)
        if (window.ResizeObserver) {
            _ro?.disconnect();
            _ro = new ResizeObserver(() => {
                const host = document.querySelector(containerSel);
                const newW = host?.clientWidth || width;
                svg.attr("width", newW).attr("height", lockedHeight);
                bounds.right = newW - PAD;
                nodes.forEach(n => { n.tx = within(n.tx, bounds.left, bounds.right); });
                if (currentMode === "roam" && sim) {
                    sim.force("x", d3.forceX(d => d.tx).strength(ROAM_STRENGTH));
                    sim.alpha(0.4).restart();
                }
            });
            _ro.observe(document.querySelector(containerSel));
        }

        // ----- metric axis -----
        function drawMetricScale(xScale, label) {
            gOverlay.selectAll("*").remove();
            const axisY = height - 24;

            const axis = d3.axisBottom(xScale).ticks(6).tickSizeOuter(0);
            const gAxis = gOverlay.append("g")
                .attr("transform", `translate(0,${axisY})`)
                .call(axis);
            gAxis.selectAll("path, line").attr("stroke", "rgba(0,0,0,0.35)");
            gAxis.selectAll("text").attr("fill", "#2b2116").attr("font-size", 11);

            gOverlay.append("text")
                .attr("x", (xScale.range()[0] + xScale.range()[1]) / 2)
                .attr("y", axisY - 10)
                .attr("text-anchor", "middle")
                .attr("fill", "#2b2116")
                .attr("font-weight", 700)
                .text(label);
        }

        // ----- layout switching -----
        function setMode(mode) {
            currentMode = mode;
            gOverlay.selectAll("*").remove();

            if (mode === "roam") {
                nodes.forEach(n => {
                    n.tx = rand(bounds.left, bounds.right);
                    n.ty = rand(bounds.top, bounds.bottom);
                });
                startRoamSim();
                return;
            }

            // stop simulation in sorted layouts to remove jitter
            if (sim) sim.stop();

            const lineBy = (getter, label) => {
                const vals = nodes.map(n => getter(n.r)).filter(Number.isFinite);
                const min = d3.min(vals) ?? 0;
                const max = d3.max(vals) ?? 1;
                const x = d3.scaleLinear().domain([min, max]).nice().range([bounds.left, bounds.right]);

                // bin along metric axis and stack vertically inside each bin
                const numBins = 18;
                const binCounts = new Array(numBins).fill(0);

                nodes.forEach(n => {
                    const v = getter(n.r);
                    if (!Number.isFinite(v)) {
                        n.__bin = -1;
                        return;
                    }
                    const denom = (max - min) || 1;
                    let t = (v - min) / denom;
                    t = clamp(0, t, 0.999999);
                    const bi = Math.floor(t * numBins);
                    n.__bin = bi;
                    binCounts[bi]++;
                });

                // multi-column layout per bin to avoid vertical overflow
                const baseRowGap = 14;
                const rowGap = baseRowGap * spacingFactor;

                const viewHeight = bounds.bottom - bounds.top;
                const maxRows = Math.max(1, Math.floor(viewHeight / rowGap));

                const binYOffset = new Array(numBins).fill(0);
                const midY = (bounds.top + bounds.bottom) / 2;

                for (let j = 0; j < numBins; j++) {
                    const rowsInBin = Math.min(binCounts[j], maxRows);
                    const totalH = (rowsInBin - 1) * rowGap;
                    binYOffset[j] = midY - totalH / 2;
                }

                const binIndexTracker = new Array(numBins).fill(0);

                nodes.forEach(n => {
                    if (n.__bin == null || n.__bin < 0) {
                        n.x = rand(bounds.left, bounds.right);
                        n.y = midY + rand(-40, 40);
                        return;
                    }
                    const j = n.__bin;
                    const k = binIndexTracker[j]++;

                    const denom = (max - min) || 1;
                    const vCenter = min + ((j + 0.5) / numBins) * denom;
                    const vCenterX = x(vCenter);

                    const cols = Math.max(1, Math.ceil(binCounts[j] / maxRows));
                    const col = Math.floor(k / maxRows);     // which column
                    const rowIdx = k % maxRows;              // which row within that column

                    const colOffset = COLLIDE_R * 2.6;
                    const xOffset = (col - (cols - 1) / 2) * colOffset;

                    n.x = within(
                        vCenterX + xOffset,
                        bounds.left + COLLIDE_R,
                        bounds.right - COLLIDE_R
                    );
                    n.y = within(
                        binYOffset[j] + rowIdx * rowGap,
                        bounds.top + COLLIDE_R,
                        bounds.bottom - COLLIDE_R
                    );
                });

                gNodes.selectAll("g.avatar")
                    .transition().duration(600)
                    .attr("transform", d => {
                        const s = d.hovered ? 1.25 : 1;
                        return `translate(${d.x},${d.y}) scale(${s})`;
                    });

                drawMetricScale(x, label);
            };

            if (mode === "sleep") lineBy(r => toNum(r[S.sleep]), "Sleep (hours) — less ◀︎ ▶︎ more");
            if (mode === "exercise") lineBy(r => toNum(r[S.exercise]), "Exercise (hours/week) — less ◀︎ ▶︎ more");
            if (mode === "severity") lineBy(r => severity10(r, S), "Combined Severity (0–10) — lower ◀︎ ▶︎ higher");
        }

        // wheel = spacing zoom in metric modes (controls vertical spacing, not actual zoom)
        svg.on("wheel.spacing", (event) => {
            if (currentMode === "roam") return;
            event.preventDefault();
            const dir = event.deltaY < 0 ? 1 : -1; // scroll up → more spacing
            spacingFactor = clamp(0.5, spacingFactor + dir * 0.12, 3);
            setMode(currentMode); // recompute layout with new spacing
        });

        // toolbar hooks
        document.getElementById("btn-roam").onclick = () => setMode("roam");
        document.getElementById("btn-sleep").onclick = () => setMode("sleep");
        document.getElementById("btn-ex").onclick = () => setMode("exercise");
        document.getElementById("btn-sev").onclick = () => setMode("severity");

        // start in Roam
        setMode("roam");
    }

    // ---------- public API ----------
    async function renderAvatarRadar(csvUrl) {
        const root = d3.select("#radar-vis");
        try {
            const rows = await d3.csv(csvUrl, d3.autoType);
            renderAvatar(rows);
        } catch (err) {
            console.error("[AvatarRadar] CSV load failed:", err);
            root.html("<div style='padding:1rem;opacity:.9'>⚠️ Couldn’t load data file.</div>");
        }
    }

    function renderAvatar(rows) {
        const root = d3.select("#radar-vis");
        if (!rows || !rows.length) {
            root.html("<div style='padding:1rem;opacity:.9'>No data rows. Check <code>data/cleaned_data.csv</code>.</div>");
            return;
        }
        try { init(rows); }
        catch (err) {
            console.error("[AvatarRadar] Render error:", err);
            root.html("<div style='padding:1rem;opacity:.9'>⚠️ Render error — see console.</div>");
        }
    }

    window.renderAvatarRadar = renderAvatarRadar;
    window.renderAvatar = renderAvatar;
})();
