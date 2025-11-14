(function() {
    const container = document.getElementById("sleep-orbit-vis");
    const width = (container.clientWidth || 980);
    const height = 400;

    const innerR = 200;
    const outerR = 300;

    // For main arc
    const cx = width/2;
    const cy = outerR + 50

    // semicircle angles: 0 to 180 in radians
    // zeros are different compared to arc
    const startAngle = 0;
    const endAngle = -Math.PI;
    const slider_radius = (outerR + innerR) / 2;

    const ticksize = 10;

    function inputValueToAngle(value) {
        return -Math.PI + ((value / 16) * Math.PI); // Map 0-16 to 0 to -PI radians
    }

    const sliders = [{ // From last to first
        angle: inputValueToAngle(document.getElementById("sleep-orbit-wake-up-time").value) // Read initial value from input
    },
    {
        angle: inputValueToAngle(document.getElementById("sleep-orbit-sleep-start-time").value)
    },
    { 
        angle: inputValueToAngle(document.getElementById("sleep-orbit-time-in-bed").value)
    }]

    const sunset_colors = ["#BF3475","#50366F","#1F214D","#FFCE61"].reverse()

    function sliderToImage(i) {
        if (i == 0) {
            return "/images/sleep-orbit/sleep.svg";
        } else if (i == 1) {
            return "/images/sleep-orbit/bed.svg";
        } else {
            return null;
        }
    }

    function computeArcsFromSliders(sliders) {
        const arcs = d3.range(sliders.length - 1).map(i => ({
            color: sunset_colors[1+i],
            startAngle: sliders[i].angle + Math.PI / 2,
            endAngle: sliders[i + 1].angle + Math.PI / 2,
            image: sliderToImage(i)
        }));
        
        arcs.push({
            color: sunset_colors[0],
            startAngle: startAngle + Math.PI / 2,
            endAngle: sliders[0].angle + Math.PI / 2,
            image: "/images/sleep-orbit/awake.svg"
        }); // First slice

        arcs.push({
            color: sunset_colors[3],
            startAngle: sliders[sliders.length-1].angle + Math.PI / 2,
            endAngle: endAngle + Math.PI / 2,
            image: "/images/sleep-orbit/tired.svg",
        }); // Last slice
        return arcs;
    }

    const arcGen = d3.arc() // Start/end angle already set in consts
    .innerRadius(innerR)
    .outerRadius(outerR)

    function renderSleepOrbit() {
        // Creates the persistent SVG elements of the visualization
        root = d3.select(container)

        const svg = root.insert("svg", ":first-child") // Insert before other content
            .attr("width", width)
            .attr("height", height)
            .attr("id", "sleep-orbit-svg")
            .append("g")
            .attr("transform", "translate(" + cx +  "," + cy + ")");

        //console.log(arcs)
        const arcs = computeArcsFromSliders(sliders);

        svg.append("g") // Add SVG group for arcs
            .selectAll("path")
            .data(arcs)
            .enter()
            .append("path")
            .attr("class", "sleep-orbit-arc")
            .attr("fill", d => d.color);
        
        const tick_angles = d3.range(17).map(i => { // 16 segments for 16 hours, so 17 ticks
            const time = (36 - i)%24 // Hour in 24H time (starting at 8pm), reversed
            let timestring;
            if (time == 0) {
                timestring = "12 AM";
            } else if (time == 12) {
                timestring = time + " PM";
            } else if (time >= 13) {
                timestring = time%12 + " PM";
            } else {
                timestring = time + " AM"
            }

            return {
                angle: startAngle + ((endAngle-startAngle)*i/16),
                time: timestring
            };
        })

        // draw ticks
        svg.append("g")
            .selectAll("line")
            .data(tick_angles)
            .enter()
            .append("line")
            .attr("x1", t => outerR * Math.cos(t.angle))
            .attr("y1", t => outerR * Math.sin(t.angle))
            .attr("x2", t => (outerR+ticksize) * Math.cos(t.angle))
            .attr("y2", t => (outerR+ticksize) * Math.sin(t.angle))
            .attr("stroke", "#333")
            .attr("stroke-width", 2)
        
        // draw time labels
        svg.append("g")
            .selectAll("text")
            .data(tick_angles)
            .enter()
            .append("text")
            .attr("x", t => (outerR+ticksize+5) * Math.cos(t.angle))
            .attr("y", t => (outerR+ticksize+5) * Math.sin(t.angle))
            .text(t => t.time)
            .attr("fill", "grey")
            .attr("font-size", 7);
    
        svg.append("g") // Draw arc icons
            .selectAll("path")
            .data(arcs)
            .enter()
            .append("image")
            .attr("xlink:href", d => d.image)
            .attr("class", "sleep-orbit-arc-icon")
            .attr("width", 30)
            .attr("height", 30);
    }

    function updateSleepOrbit(data) {
        const arcs = computeArcsFromSliders(sliders);

        d3.selectAll(".sleep-orbit-arc")
            .data(arcs)
            .transition()
            .duration(200)
            .attr("d", d => arcGen(d));

        d3.selectAll(".sleep-orbit-arc-icon")
            .data(arcs)
            .transition()
            .duration(200)
            .attr("x", d => {
                const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
                return slider_radius * Math.cos(angle) - 15;
            })
            .attr("y", d => {
                const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
                return slider_radius * Math.sin(angle) - 15;
            });

    }
    
    window.renderSleepOrbit = renderSleepOrbit;
    window.updateSleepOrbit = updateSleepOrbit;

    // Attach event listeners to inputs, only done once
    document.getElementById("sleep-orbit-time-in-bed").addEventListener("input", function() {
        const value = parseFloat(this.value);
        const new_angle = inputValueToAngle(value); // Map 0-16 to 0 to -PI radians
        if (new_angle > sliders[1].angle) {
            // Undo change
            this.value = ((-sliders[1].angle + Math.PI) / Math.PI) * 16;
            return;
        }
        sliders[2].angle = inputValueToAngle(value);
        updateSleepOrbit();
    });

    document.getElementById("sleep-orbit-sleep-start-time").addEventListener("input", function() {
        const value = parseFloat(this.value);
        const new_angle = inputValueToAngle(value); // Map 0-16 to 0 to -PI radians
        if (new_angle < sliders[2].angle || new_angle > sliders[0].angle) {
            // Undo change
            this.value = ((-sliders[1].angle + Math.PI) / Math.PI) * 16;
            return;
        }
        sliders[1].angle = inputValueToAngle(value);
        updateSleepOrbit();
    });

    document.getElementById("sleep-orbit-wake-up-time").addEventListener("input", function() {
        const value = parseFloat(this.value);
        const new_angle = inputValueToAngle(value); // Map 0-16 to 0 to -PI radians
        if (new_angle < sliders[1].angle) {
            // Undo change
            this.value = ((-sliders[0].angle + Math.PI) / Math.PI) * 16;
            return;
        }
        sliders[0].angle = inputValueToAngle(value);
        updateSleepOrbit();
    });
})()