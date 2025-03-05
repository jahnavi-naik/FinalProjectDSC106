// Initialize the visualization when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    d3.csv('data/data.csv').then(rawData => {
        // Process the data to get unique participants and their max times
        const participantData = processData(rawData);
        
        // Initialize the visualization
        createVisualization(participantData, rawData);

    }).catch(error => {
        console.error('Error loading the data:', error);
        document.getElementById('timeline').innerHTML = 'Error loading data. Please check the console for details.';
    });
});

function processData(rawData) {
    // Group data by participant ID
    const groupedData = d3.group(rawData, d => d.ID_x);
    
    // Process each participant's data
    const participants = Array.from(groupedData).map(([id, data]) => {
        const participant = data[0]; // Get participant's demographic data
        return {
            id: id,
            age: +participant.Age,
            gender: participant.Sex === '1' ? 'F' : 'M', // Assuming 1 = Female, else Male
            weight: +participant.Weight_lb,
            height: +participant.Height_in,
            endurance: d3.max(data, d => +d.Max_Time),
            humidity: +participant.Humidity,
            temperature: +participant.Temperature,
            maxHR: d3.max(data, d => +d.HR || 0),
            maxSpeed: d3.max(data, d => +d.Speed || 0),
            timeSeriesData: data.map(d => ({
                time: +d.time,
                speed: +d.Speed_mph || 0,
                hr: +d.HR || 0,
                vo2: +d.VO2 || 0
            })).sort((a, b) => a.time - b.time)
        };
    });

    return participants;
}

function createVisualization(participants, rawData) {
    // Set up dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const timelineContainer = document.getElementById('timeline');
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    timelineContent.style.width = '22000px';
    timelineContainer.appendChild(timelineContent);

    const width = timelineContent.clientWidth - margin.left - margin.right;
    const height = timelineContainer.clientHeight - margin.top - margin.bottom;

    // Create SVG container for timeline
    const timelineSvg = d3.select(timelineContent)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const shading = timelineSvg.append('rect')
        .attr('class', 'shading')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)  // Initially set width to 0
        .attr('height', height)
        .style('fill', 'rgba(188, 188, 188, 0.1)') // Light shading
        .style('pointer-events', 'none'); // Make sure it doesn't interfere with interaction

    // Group participants by their endurance time (rounded to nearest 5 seconds)
    const timeGroups = d3.group(participants, d => Math.round(d.endurance / 5) * 5);

    // Set dynamic spacing based on stack size
    const verticalSpacing = 40; // Adjust as needed to avoid overlap

    // Create array of participants with properly assigned stack positions
    const stackedParticipants = [];
    timeGroups.forEach((group, time) => {
        group.forEach((participant, index) => {
            stackedParticipants.push({
                ...participant,
                stackIndex: index,
                totalInStack: group.length
            });
        });
    });

    // Create scales for time in seconds
    const xScale = d3.scaleLinear()
        .domain([-1, d3.max(participants, d => d.endurance + 10)]) 
        .range([0, width]);

    // Define an array of objects with start time, end time, and text content
    const textsToDisplay = [
        { startTime: 80, endTime: 230, text: "A maximal graded exercise test is a physical assessment in which an individual performs progressively intense exercise until reaching voluntary exhaustion or physiological limits." },
        { startTime: 240, endTime: 360, text: "It allows researchers to evaluate cardiovascular, respiratory, and metabolic responses to maximal exertion. " },
        { startTime: 380, endTime: 550, text: "As you scroll, the running intensity increases. Each icon represents one participant who have reached their maximal effort. Here, our first participant quits at 8 min and 15 sec. Hover over the icon to learn more. " },
        { startTime: 600, endTime: 800, text: "Blue icons represent males and pink icons represent females. We can observe that more women reach their maximal effort faster than men." },
    ];

    function addTextAtIntervals(currentTime) {
        // Select all existing text elements
        const existingTexts = timelineSvg.selectAll('.interval-text');
    
        // Determine which texts should be displayed at this time
        const activeTexts = textsToDisplay.filter(entry => currentTime >= entry.startTime && currentTime <= entry.endTime);
        
        // Remove only texts that are no longer active
        existingTexts.each(function () {
            const textElement = d3.select(this);
            const textContent = textElement.text();
            const stillActive = activeTexts.some(entry => entry.text === textContent);
    
            if (!stillActive) {
                textElement.transition()
                    .duration(200)
                    .style("opacity", 0)
                    .remove();
            }
        });
    
        // Add new texts only if they are not already displayed
        activeTexts.forEach((entry) => {
            const isTextAlreadyDisplayed = existingTexts.nodes().some(node => node.textContent === entry.text);
            if (!isTextAlreadyDisplayed) {
                timelineSvg.append('text')
                    .attr('class', 'interval-text')
                    .attr('x', xScale(entry.startTime + (entry.endTime - entry.startTime) / 2)) // Center in interval
                    .attr('y', height / 2)  // Middle of the SVG
                    .text(entry.text)
                    .style("opacity", 0)  // Start invisible
                    .transition()
                    .duration(200) // Smooth fade-in
                    .style("opacity", 1);
            }
        });
    }

    // Update time indicator based on scroll position
    function updateTimeIndicator() {
        const scrollRatio = timelineContainer.scrollLeft / (timelineContainer.scrollWidth - timelineContainer.clientWidth);
        const currentTime = scrollRatio * d3.max(participants, d => d.endurance + 10);
    
        // Update the shading width to match the current time
        shading.attr('width', xScale(currentTime));

        // Update the time display
        const timeDisplay = document.getElementById('time-display');
        timeDisplay.textContent = `CURRENT TIME: ${Math.floor(currentTime / 60)} min ${Math.floor(currentTime % 60)} sec`;

        addTextAtIntervals(currentTime);
    
        // Update visualizations based on current time
        updateVisualization(currentTime, participants);

    }

    // Add grid lines
    timelineSvg.selectAll('.grid-line')
        .data(d3.range(0, d3.max(participants, d => d.endurance + 10), 5))
        .enter()
        .append('line')
        .attr('class', 'grid-line')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', 0)
        .attr('y2', height)
        .style('stroke', '#eee')
        .style('stroke-width', 1);

    // Add time labels in the format "X m Y s"
    timelineSvg.selectAll('.time-label')
        .data(d3.range(0, d3.max(participants, d => d.endurance + 10), 15))
        .enter()
        .append('text')
        .attr('class', 'time-label')
        .attr('x', d => xScale(d))
        .attr('y', height + 20)
        .text(d => `${Math.floor(d / 60)} m ${d % 60} s`)
        .style('font-size', '1em')
        .style('text-anchor', 'middle');

    timelineSvg.append('foreignObject')
        .attr('class', 'text-box')  // Add class to the foreignObject
        .attr('x', 100)   // Set the X position of the text box
        .attr('y', 150)   // Set the Y position of the text box
        .append('xhtml:div')  // Use 'xhtml' to access HTML elements inside SVG
        .attr('class', 'text-box-content')  // Add a separate class to the content div
        .html('<p>Between 2008 and 2018, researchers at the University of Málaga conducted maximal graded exercise tests (GETs) to investigate how respiratory systems perform under extreme physical exertion. Our webpage presents the results of 857 participants. Scroll to the right to explore!</p>');

    const iconSize = 36;  // Size of the icon
    const dots = timelineSvg.selectAll('.runner-dot')
        .data(stackedParticipants)
        .enter()
        .append('image')
        .attr('class', 'runner-dot') 
        .attr('x', d => xScale(d.endurance) - iconSize / 2)  // Center horizontally
        .attr('y', d => height - (d.stackIndex + 1) * verticalSpacing)  
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('xlink:href', d => d.gender === 'F' ? 'icons/female-icon.svg' : 'icons/male-icon.svg')
        .style('opacity', 0.8);

    // Enhanced tooltip to show stack information
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'timeline-tooltip')
        .style('opacity', 0);

    dots.on('mouseover', (event, d) => {
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);

        tooltip.html(`
            <strong>Runner #${d.id}</strong><br/>
            Age: ${d.age.toFixed(1)} years<br/>
            Gender: ${d.gender}<br/>
            Weight: ${d.weight.toFixed(1)} lbs<br/>
            Height: ${d.height.toFixed(1)} in<br/>
            Endurance: ${Math.floor(d.endurance / 60)} min ${(d.endurance % 60).toFixed(0)} sec<br/>
            Max HR: ${d.maxHR} bpm<br/>
            Max Speed: ${d.maxSpeed.toFixed(2)} mph<br/>
            Temperature: ${d.temperature}°C<br/>
            Humidity: ${d.humidity}%<br/>
        `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');

        d3.select(event.target)
            .transition()
            .duration(200)
            .style('opacity', 1);
    })
    .on('mouseout', (event) => {
        tooltip.transition()
            .duration(500)
            .style('opacity', 0);

        d3.select(event.target)
            .transition()
            .duration(200)
            .style('opacity', 0.8);
    });

    // Add scroll event listener
    timelineContainer.addEventListener('scroll', () => {
        updateTimeIndicator();
    });

    // Calculate milestones based on data
    const milestones = calculateMilestones(participants);

    // Add milestone markers
    const milestoneMarkers = timelineSvg.selectAll('.milestone')
        .data(milestones)
        .enter()
        .append('g')
        .attr('class', 'milestone')
        .attr('transform', d => `translate(${xScale(d.time)},0)`);

    milestoneMarkers.append('line')
        .attr('class', 'milestone-line')
        .attr('y1', 0)
        .attr('y2', height);

    milestoneMarkers.append('text')
        .attr('class', 'milestone-text')
        .attr('y', -10)
        .text(d => d.description);

    // Create demographic charts
    createDemographicCharts(participants);
}

function calculateMilestones(data) {
    const sortedEndurance = data.map(d => d.endurance).sort((a, b) => a - b);
    const totalParticipants = sortedEndurance.length;
    
    return [
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.25)],
            description: "25% of runners stopped"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.5)],
            description: "50% of runners stopped"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.75)],
            description: "75% of runners stopped"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.9)],
            description: "90% of runners stopped"
        }
    ];
}

function createDemographicCharts(participants) {
    createAgeChart(participants);
    createGenderChart(participants);
    createWeightChart(participants);
    createHeightChart(participants);
}

function createAgeChart(participants) {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const container = document.getElementById('age-chart');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom - 30; // Account for title

    const svg = d3.select('#age-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create age groups (0-10, 11-20, etc.)
    const ageGroups = d3.group(participants, d => Math.floor(d.age / 10) * 10);
    const data = Array.from(ageGroups, ([key, value]) => ({
        age: key,
        count: value.length
    })).sort((a, b) => a.age - b.age);

    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1)
        .domain(data.map(d => d.age));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.count)]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d => `${d}-${d+9}`));

    svg.append('g')
        .call(d3.axisLeft(y));

    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.age))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.count))
        .attr('height', d => height - y(d.count))
        .style('fill', '#3498db');
}

function createGenderChart(participants) {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const container = document.getElementById('gender-chart');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom - 30;

    const svg = d3.select('#gender-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);

    const genderCounts = d3.group(participants, d => d.gender);
    const data = Array.from(genderCounts, ([key, value]) => ({
        gender: key,
        count: value.length
    }));

    const radius = Math.min(width, height) / 2;
    const color = d3.scaleOrdinal()
        .domain(['M', 'F'])
        .range(['#3498db', '#e74c3c']);

    const pie = d3.pie()
        .value(d => d.count);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const arcs = svg.selectAll('arc')
        .data(pie(data))
        .enter()
        .append('g');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.gender));

    // Add labels
    arcs.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .text(d => `${d.data.gender} (${d.data.count})`)
        .style('fill', 'white')
        .style('font-size', '12px');
}

function createWeightChart(participants) {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const container = document.getElementById('weight-chart');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom - 30;

    const svg = d3.select('#weight-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create weight groups (every 10 kg)
    const weightGroups = d3.group(participants, d => Math.floor(d.weight / 10) * 10);
    const data = Array.from(weightGroups, ([key, value]) => ({
        weight: key,
        count: value.length
    })).sort((a, b) => a.weight - b.weight);

    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1)
        .domain(data.map(d => d.weight));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.count)]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d => `${d}kg`));

    svg.append('g')
        .call(d3.axisLeft(y));

    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.weight))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.count))
        .attr('height', d => height - y(d.count))
        .style('fill', '#2ecc71');
}

function createHeightChart(participants) {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const container = document.getElementById('height-chart');
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom - 30;

    const svg = d3.select('#height-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create height groups (every 5 cm)
    const heightGroups = d3.group(participants, d => Math.floor(d.height / 5) * 5);
    const data = Array.from(heightGroups, ([key, value]) => ({
        height: key,
        count: value.length
    })).sort((a, b) => a.height - b.height);

    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1)
        .domain(data.map(d => d.height));

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(data, d => d.count)]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d => `${d}cm`));

    svg.append('g')
        .call(d3.axisLeft(y));

    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.height))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.count))
        .attr('height', d => height - y(d.count))
        .style('fill', '#9b59b6');
}

function updateVisualization(currentTime, participants) {
    // Update insights panel
    const activeParticipants = participants.filter(p => p.timeSeriesData.some(d => d.time >= currentTime));
    const stoppedParticipants = participants.filter(p => !p.timeSeriesData.some(d => d.time >= currentTime));
    
    const insights = {
        totalActive: activeParticipants.length,
        totalStopped: stoppedParticipants.length,
        averageAge: d3.mean(activeParticipants, d => d.age),
        averageHR: d3.mean(activeParticipants, d => d.maxHR),
        genderDistribution: {
            male: activeParticipants.filter(d => d.gender === 'M').length,
            female: activeParticipants.filter(d => d.gender === 'F').length
        }
    };

    updateInsightsPanel(insights, currentTime);

    // Update charts with dynamic data
    updateDemographicCharts(activeParticipants, stoppedParticipants);
}

function updateInsightsPanel(insights, currentTime) {
    const insightsHtml = `
        <p>Current Time: ${Math.floor(currentTime / 60)} min ${Math.floor(currentTime % 60)} sec</p>
        <p>Active Runners: ${insights.totalActive}</p>
        <p>Stopped Runners: ${insights.totalStopped}</p>
        <p>Average Age of Active Runners: ${insights.averageAge ? insights.averageAge.toFixed(1) : 'N/A'} years</p>
        <p>Average Max HR of Active Runners: ${insights.averageHR ? insights.averageHR.toFixed(0) : 'N/A'} bpm</p>
        <p>Gender Distribution (Active):
            M: ${insights.genderDistribution.male},
            F: ${insights.genderDistribution.female}
        </p>
    `;
    document.getElementById('dynamic-insights').innerHTML = insightsHtml;
}

function updateDemographicCharts(activeParticipants, stoppedParticipants) {
    // Calculate averages and proportions
    const calculateAverages = (group) => {
        const avgAge = d3.mean(group, d => d.age);
        const avgWeight = d3.mean(group, d => d.weight);
        const avgHeight = d3.mean(group, d => d.height);
        const genderProportion = d3.rollup(group, v => v.length / group.length, d => d.gender);
        return { avgAge, avgWeight, avgHeight, genderProportion };
    };

    const activeStats = calculateAverages(activeParticipants);
    const stoppedStats = calculateAverages(stoppedParticipants);

    // Update charts with new data
    // Assume functions updateAgeChart, updateWeightChart, updateHeightChart, updateGenderChart exist
    updateAgeChart(activeStats.avgAge, stoppedStats.avgAge);
    updateWeightChart(activeStats.avgWeight, stoppedStats.avgWeight);
    updateHeightChart(activeStats.avgHeight, stoppedStats.avgHeight);
    updateGenderChart(activeStats.genderProportion, stoppedStats.genderProportion);
}
