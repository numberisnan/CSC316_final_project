function renderClassroom(data, filters = { year: "All", major: "All", gender: "All" }) {
    const TOTAL = 56;
    const majors = [
        "BBA", "Biotech", "Chemical", "Civil",
        "Computer Application", "Computer Science",
        "design", "Designer", "EEE/ECE", "EEE/ECE/EIE",
        "Fashion Technology", "Fine Arts", "industrial engineering",
        "MBBS", "Mechanical", "Statistics"
    ];

    const randomGender = () => (Math.random() < 0.5 ? "Male" : "Female");

    let students = Array.from({ length: TOTAL }, (_, i) => {
        let d = data[i % data.length];
        return {
            stress_level: d.stress_level ?? Math.floor(Math.random() * 3),
            major: filters.major === "All" ? 
                    (d.major ?? majors[Math.floor(Math.random() * majors.length)]) : 
                    filters.major,
            age: d.age ?? Math.floor(Math.random() * 10 + 18),
            gender: filters.gender === "All"
                ? (Math.random() < 0.5 ? "Male" : "Female")
                : filters.gender
        };
    });

    // average stress, age per major
    let averages = {};
    majors.forEach((major) => {
        let majorData = data.filter(d => d.major === major);
        if (majorData.length === 0) return;

        let avgStress = d3.mean(majorData, d => d.stress_level);
        let avgAge = d3.mean(majorData, d => d.age);
        let genderCounts = d3.rollup(
            majorData,
            v => v.length,
            d => d.gender
        );

        averages[major] = {
            avgStress,
            avgAge,
            genderCounts
        };
    });

    console.log("Averages per major:", averages);

    //layout
    const padding = 20;
    const headR = 12;
    const bodyH = 24;
    const armW = 16;
    const legH = 18;

    const cols = Math.ceil(Math.sqrt(TOTAL));
    const rows = Math.ceil(TOTAL / cols);

    // compute svg size
    const width = cols * (armW * 2 + padding);
    const height = rows * (headR * 2 + bodyH + legH + padding);

    const colourScale = d3.scaleOrdinal()
                        .domain([0, 1, 2])
                        .range(["lightblue", "orange", "red"]);

    d3.select("#classroom-vis").selectAll("*").remove();

    const svg = d3.select("#classroom-vis")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");


    function getCurrentFilters() {
        const year = document.getElementById("fYear")?.value || "All";
        const major = document.getElementById("fMajor")?.value || "All";
        const gender = document.getElementById("fGender")?.value || "All";
        return { year, major, gender };
    }

    const tooltip = d3.select("#tooltip");

    students.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (armW * 2 + padding) + armW + padding / 2;
        const y = row * (headR * 2 + bodyH + legH + padding) + headR;

        const g = svg.append("g")
            .datum(d)
            .attr("transform", `translate(${x}, ${y})`)
            .style("cursor", "pointer");

        const colour = colourScale(d.stress_level);

        // Head
        g.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", headR)
            .attr("fill", colour);

        // Body
        g.append("line")
            .attr("x1", 0)
            .attr("y1", headR)
            .attr("x2", 0)
            .attr("y2", headR + bodyH)
            .attr("stroke", colour)
            .attr("stroke-width", 6)
            

        // Arms
        g.append("line")
            .attr("x1", -armW)
            .attr("y1", headR + bodyH / 3)
            .attr("x2", armW)
            .attr("y2", headR + bodyH / 3)
            .attr("stroke", colour)
            .attr("stroke-width", 6);

        // Legs
        g.append("line")
            .attr("x1", 0)
            .attr("y1", headR + bodyH)
            .attr("x2", -armW)
            .attr("y2", headR + bodyH + legH)
            .attr("stroke", colour)
            .attr("stroke-width", 6);

        g.append("line")
            .attr("x1", 0)
            .attr("y1", headR + bodyH)
            .attr("x2", armW)
            .attr("y2", headR + bodyH + legH)
            .attr("stroke", colour)
            .attr("stroke-width", 6);

        //tooltip
        g.on("mouseover", function(event) {
            const d = d3.select(this).datum();
            const { year, major, gender } = getCurrentFilters();
            const stressLabel = d.stress_level === 0 ? "Low" : d.stress_level === 1 ? "Moderate" : "High";

            const displayGender = gender === "All" ? d.gender : gender;

            tooltip.style("display", "block")
                .html(`
                    <strong>Year:</strong> ${year}<br/>
                    <strong>Major:</strong> ${major}<br/>
                    <strong>Gender:</strong> ${displayGender}<br/>
                    <strong>Stress Level:</strong> ${stressLabel}
                `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });
    });


    //legend
    const legendData = [
        { label: "Low Stress", color: "lightblue" },
        { label: "Moderate Stress", color: "orange" },
        { label: "High Stress", color: "red" }
    ];

    const legendX = 500; 
    const legendY = height - 350; 
    const legendSpacing = 25;

    const legend = svg.append("g")
        .attr("class", "legend");

    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", legendX)
        .attr("y", (d, i) => legendY + i * legendSpacing)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", legendX + 30)
        .attr("y", (d, i) => legendY + i * legendSpacing + 15)
        .text(d => d.label)
        .attr("font-size", "14px")
        .attr("fill", "#333");

}


function updateClassroom(filteredData) {

    const stressCounts = d3.rollup(filteredData, v => v.length, d => d.stress_level);
    const total = d3.sum(Array.from(stressCounts.values()));

    const proportions = {
        0: (stressCounts.get(0) || 0) / total,
        1: (stressCounts.get(1) || 0) / total,
        2: (stressCounts.get(2) || 0) / total
    };

    const colourScale = d3.scaleOrdinal()
        .domain([0, 1, 2])
        .range(["lightblue", "orange", "red"]);

    const totalFigures = d3.selectAll("#classroom-vis svg g").size();

    const stressDistribution = {
        0: Math.round(proportions[0] * totalFigures),
        1: Math.round(proportions[1] * totalFigures),
        2: Math.round(proportions[2] * totalFigures)
    };

    const currentSum = stressDistribution[0] + stressDistribution[1] + stressDistribution[2];
    if (currentSum < totalFigures) {
        const maxKey = Object.entries(stressDistribution).sort((a,b)=>b[1]-a[1])[0][0];
        stressDistribution[maxKey] += (totalFigures - currentSum);
    }

    const stressArray = [];
    Object.entries(stressDistribution).forEach(([level, count]) => {
        for (let i = 0; i < count; i++) stressArray.push(+level);
    });

    d3.shuffle(stressArray);

    d3.select("#classroom-vis svg")
        .selectAll("g") 
        .each(function(_, i) {
            const stressLevel = stressArray[i % stressArray.length];
            const colour = colourScale(stressLevel);
            const g = d3.select(this);
            g.selectAll("circle, line").transition().duration(600)
                .attr("stroke", colour)
                .attr("fill", colour);
        });
    
    d3.select("#classroom-vis svg")
    .selectAll("g")
    .each(function(_, i) {
        const stressLevel = stressArray[i % stressArray.length];
        const colour = colourScale(stressLevel);
        const g = d3.select(this);

        const boundData = g.datum() || {};
        boundData.stress_level = stressLevel;
        g.datum(boundData);

        g.selectAll("circle, line").transition().duration(600)
            .attr("stroke", colour)
            .attr("fill", colour);
    });

}


renderClassroom(window.__FULL_ROWS__, { 
    year: selectedYear, 
    major: selectedMajor, 
    gender: selectedGender 
});

window.updateClassroom = updateClassroom;