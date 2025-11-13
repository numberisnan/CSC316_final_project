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
        const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
        return a;
    };

    // ---------- schema ----------
    function firstKey(rows, candidates) {
        const head = new Set(Object.keys(rows[0] || {}));
        for (const k of candidates) if (head.has(k)) return k;
        const lower = {}; for (const k of head) lower[k.toLowerCase()] = k;
        for (const k of candidates) { const hit = lower[k.toLowerCase()]; if (hit) return hit; }
        return null;
    }
    function buildSchema(rows) {
        if (!rows || !rows.length) return null;
        const sleep = firstKey(rows, ["sleep_hours", "sleep", "sleep_duration", "avg_sleep_hours",
            "4._on_average,_how_many_hours_of_sleep_do_you_get_on_a_typical_day?",
            "how_many_hours_of_actual_sleep_did_you_get_on_an_average_for_the_past_month?_(maybe_different_from_the_number_of_hours_spent_in_bed)",
            "what_is_your_average_hours_of_sleep_per_night?"]);
        const exercise = firstKey(rows, ["exercise_hours", "avg_exercise", "exercise_hours_per_week", "exercise", "extracurricular_activities"]);
        const anxiety = firstKey(rows, ["anxiety_score", "anxiety", "gad7", "anxiety_level"]);
        const depression = firstKey(rows, ["depression_score", "depression", "phq9"]);
        const stress = firstKey(rows, ["stress_score", "stress", "rate_your_academic_stress_index", "avg_stress", "stress_level"]);
        return { sleep, exercise, anxiety, depression, stress };
    }

    // ---------- normalization + mood ----------
    const norm = {
        sleep: v => clamp(0, (v ?? 0) / 9, 1),
        ex: v => clamp(0, (v ?? 0) / 12, 1),
        anx: v => clamp(0, 1 - (v ?? 0) / 10, 1),
        dep: v => clamp(0, 1 - (v ?? 0) / 10, 1),
        str: v => clamp(0, 1 - (v ?? 0) / 10, 1),
    };
    const avg = (arr) => { const a = arr.filter(Number.isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };


    function severity10(r, S) {
        const vals = [toNum(r[S.stress]), toNum(r[S.anxiety]), toNum(r[S.depression])].filter(Number.isFinite);
        if (!vals.length) return 5;
        return clamp(0, avg(vals), 10); // 0..10 (worse → higher)
    }

    function colorByMood(r, S) {
        // green (good) → red (bad)
        const t = clamp(0, severity10(r, S) / 10, 1);
        return d3.interpolateRdYlGn(1 - t);
    }

    function metricsForRow(r, S) {
        return [
            { label: "Sleep (hrs)", v: norm.sleep(toNum(r[S.sleep])) },
            { label: "Exercise (hrs/wk)", v: norm.ex(toNum(r[S.exercise])) },
            { label: "Anxiety", v: norm.anx(toNum(r[S.anxiety])) },
            { label: "Depression", v: norm.dep(toNum(r[S.depression])) },
            { label: "Stress", v: norm.str(toNum(r[S.stress])) },
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

    // ---------- mini spider chart ----------
    function drawMiniRadar(gOverlay, x, y, row, S) {
        const color = colorByMood(row, S);
        const metrics = metricsForRow(row, S);
        const R = 60;
        const angle = d3.scaleLinear().domain([0, metrics.length]).range([0, 2 * Math.PI]);
        const radial = (v, i) => { const a = angle(i) - Math.PI / 2, rr = v * R; return [Math.cos(a) * rr, Math.sin(a) * rr]; };
        const pathFn = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveLinearClosed);

        gOverlay.selectAll("*").remove();
        const grp = gOverlay.append("g").attr("transform", `translate(${x},${y})`).style("pointer-events", "none");

        grp.append("circle").attr("r", R + 8).attr("fill", "rgba(255,255,255,0.94)").attr("stroke", "rgba(0,0,0,0.08)").attr("stroke-width", 1.5);
        for (let i = 1; i <= 4; i++) grp.append("circle").attr("r", (R / 4) * i).attr("fill", "none").attr("stroke", "#444").attr("opacity", 0.15);
        metrics.forEach((m, i) => {
            const a = angle(i) - Math.PI / 2, xx = Math.cos(a) * R, yy = Math.sin(a) * R;
            grp.append("line").attr("x1", 0).attr("y1", 0).attr("x2", xx).attr("y2", yy).attr("stroke", "#444").attr("opacity", 0.18);
        });

        grp.append("path")
            .attr("d", pathFn(metrics.map((m, i) => radial(m.v, i))))
            .attr("fill", color).attr("fill-opacity", 0.28)
            .attr("stroke", color).attr("stroke-width", 2);

        metrics.forEach((m, i) => {
            const a = angle(i) - Math.PI / 2, rr = R + 10;
            grp.append("text").attr("x", Math.cos(a) * rr).attr("y", Math.sin(a) * rr)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("font-size", 9).attr("fill", "#222").text(m.label.split(" ")[0]);
        });
    }

    // ---------- stick figure (mood-colored) ----------
    function drawWalker(g, nodeDatum) {
        const color = nodeDatum.color;
        const strokeW = 2.4;                         // slightly thicker
        const body = g.append("g").attr("class", "walker").attr("transform", "scale(0.92)");

        const headStrokeColor = d3.interpolateRgb(color, "#333")(0.35);
        body.append("circle")
            .attr("cx", 0)
            .attr("cy", -20)                         // nudge up a bit
            .attr("r", 8)                            // ⬅ larger head
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
        svg = rootSel.append("svg").attr("width", width).attr("height", height).style("display", "block");
        gNodes = svg.append("g");
        gOverlay = svg.append("g").style("pointer-events", "none");

        const PAD = 18, COLLIDE_R = 12, ROAM_STRENGTH = 0.06;
        const N = Math.min(rows.length, 250);
        const nodes = d3shuffle(rows).slice(0, N).map((r, i) => ({
            id: i, r, color: colorByMood(r, S), tx: 0, ty: 0
        }));

        const bounds = { left: PAD, right: width - PAD, top: PAD, bottom: height - PAD };
        nodes.forEach(n => { n.tx = rand(bounds.left, bounds.right); n.ty = rand(bounds.top, bounds.bottom); });

        sim?.stop();
        sim = d3.forceSimulation(nodes)
            .velocityDecay(0.25)
            .force("charge", d3.forceManyBody().strength(-6))
            .force("collide", d3.forceCollide().radius(COLLIDE_R).iterations(2))
            .force("x", d3.forceX(d => d.tx).strength(ROAM_STRENGTH))
            .force("y", d3.forceY(d => d.ty).strength(ROAM_STRENGTH))
            .alpha(1).alphaDecay(0.02)
            .on("tick", () => {
                gNodes.selectAll("g.avatar").attr("transform", d => {
                    d.x = within(d.x ?? width / 2, bounds.left, bounds.right);
                    d.y = within(d.y ?? height / 2, bounds.top, bounds.bottom);
                    return `translate(${d.x},${d.y})`;
                });
            });

        const sel = gNodes.selectAll("g.avatar")
            .data(nodes, d => d.id)
            .join(enter => {
                const gEnter = enter.append("g")
                    .attr("class", "avatar")
                    .style("cursor", "pointer");

                // draw one walker per node with its own color
                gEnter.each(function (d) {
                    drawWalker(d3.select(this), d);
                });

                gEnter
                    .on("mouseenter", (e, d) => {
                        gOverlay.selectAll("*").remove();
                        drawMiniRadar(gOverlay, d.x ?? width / 2, d.y ?? height / 2, d.r, S);
                    })
                    .on("mouseleave", () => gOverlay.selectAll("*").remove())
                    .on("click", (e, d) => {
                        gOverlay.selectAll("*").remove();
                        drawMiniRadar(gOverlay, d.x ?? width / 2, d.y ?? height / 2, d.r, S);
                    });

                return gEnter;
            });

        // subtle target jitter in Roam mode
        d3.interval(() => {
            if (currentMode !== "roam") return;
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
                sim.force("x", d3.forceX(d => d.tx).strength(ROAM_STRENGTH));
                sim.alpha(0.4).restart();
            });
            _ro.observe(document.querySelector(containerSel));
        }

        // ----- layout switching -----
        function drawMetricScale(xScale, label) {
            gOverlay.selectAll("*").remove();
            const axisY = height - 24;

            // Axis line + ticks
            const axis = d3.axisBottom(xScale).ticks(6).tickSizeOuter(0);
            const gAxis = gOverlay.append("g").attr("transform", `translate(0,${axisY})`).call(axis);
            gAxis.selectAll("path, line").attr("stroke", "rgba(0,0,0,0.35)");
            gAxis.selectAll("text").attr("fill", "#2b2116").attr("font-size", 11);

            // Title
            gOverlay.append("text")
                .attr("x", (xScale.range()[0] + xScale.range()[1]) / 2)
                .attr("y", axisY - 10)
                .attr("text-anchor", "middle")
                .attr("fill", "#2b2116")
                .attr("font-weight", 700)
                .text(label);
        }

        function setMode(mode) {
            currentMode = mode;
            gOverlay.selectAll("*").remove();

            sim.force("charge", d3.forceManyBody().strength(-6));
            sim.force("collide", d3.forceCollide().radius(COLLIDE_R).iterations(2));

            if (mode === "roam") {
                nodes.forEach(n => { n.tx = rand(bounds.left, bounds.right); n.ty = rand(bounds.top, bounds.bottom); });
                sim.force("x", d3.forceX(d => d.tx).strength(ROAM_STRENGTH));
                sim.force("y", d3.forceY(d => d.ty).strength(ROAM_STRENGTH));
                sim.alpha(0.8).restart();
                return;
            }

            const lineBy = (getter, label) => {
                const vals = nodes.map(n => getter(n.r)).filter(Number.isFinite);
                const min = d3.min(vals) ?? 0;
                const max = d3.max(vals) ?? 1;
                const x = d3.scaleLinear().domain([min, max]).nice().range([bounds.left, bounds.right]);

                sim.force("x", d3.forceX(d => x(getter(d.r))).strength(0.25));
                sim.force("y", d3.forceY(height / 2).strength(0.06));

                drawMetricScale(x, label);
                sim.alpha(0.8).restart();
            };

            if (mode === "sleep") lineBy(r => toNum(r[S.sleep]), "Sleep (hours) — less ◀︎ ▶︎ more");
            if (mode === "exercise") lineBy(r => toNum(r[S.exercise]), "Exercise (hours/week) — less ◀︎ ▶︎ more");
            if (mode === "severity") lineBy(r => severity10(r, S), "Combined Severity (0–10) — lower ◀︎ ▶︎ higher");
        }

        // toolbar hooks
        document.getElementById("btn-roam").onclick = () => setMode("roam");
        document.getElementById("btn-sleep").onclick = () => setMode("sleep");
        document.getElementById("btn-ex").onclick = () => setMode("exercise");
        document.getElementById("btn-sev").onclick = () => setMode("severity");

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
