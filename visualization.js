// Initialize the visualization when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    d3.csv('data/data.csv').then(rawData => {
        // Process the data to get unique participants and their max times
        const participantData = processData(rawData);
        
        // Initialize the visualization
        createVisualization(participantData, rawData);
        
        // Set the initial time display text
        document.getElementById('time-display').textContent = 'CURRENT TIME: 0 min 0 sec';
        document.querySelector('#insights-panel h3').textContent = 'Key Insights at 0 min 0 sec';

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

    // Add shading that will cover the full height
    // First, add a background rect to cover the entire SVG area
    timelineSvg.append('rect')
        .attr('class', 'background')
        .attr('x', 0)
        .attr('y', -margin.top) // Start above the g element to cover the full height
        .attr('width', width)
        .attr('height', height + margin.top + margin.bottom)
        .style('fill', 'transparent'); // Transparent background
        
    const shading = timelineSvg.append('rect')
        .attr('class', 'shading')
        .attr('x', 0)
        .attr('y', -margin.top) // Extend above the g element
        .attr('width', 0)  // Initially set width to 0
        .attr('height', height + margin.top + margin.bottom) // Cover the full height including margins
        .style('fill', 'rgba(188, 188, 188, 0.15)') // Slightly darker shading
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
        
    // Initialize with time 0
    updateVisualization(0, participants);
    
    // Set initial shading at time 0
    shading.attr('width', xScale(0));
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

function updateVisualization(currentTime, participants) {
    // Identify active and stopped participants
    // A participant is active if their endurance time is greater than the current time
    const activeParticipants = participants.filter(p => p.endurance > currentTime);
    // A participant has stopped if their endurance time is less than or equal to the current time
    const stoppedParticipants = participants.filter(p => p.endurance <= currentTime);
    
    // Update the title of the insights panel with current time
    document.querySelector('#insights-panel h3').textContent = 
        `Key Insights at ${Math.floor(currentTime / 60)} min ${Math.floor(currentTime % 60)} sec`;
    
    // Update all comparison charts
    updateCountComparisonChart(activeParticipants, stoppedParticipants);
    updateAgeComparisonChart(activeParticipants, stoppedParticipants);
    updateGenderComparisonChart(activeParticipants, stoppedParticipants);
    updateHeightComparisonChart(activeParticipants, stoppedParticipants);
    updateWeightComparisonChart(activeParticipants, stoppedParticipants);
}

// New function to create and update the count comparison chart
function updateCountComparisonChart(activeParticipants, stoppedParticipants) {
    const chartContainer = document.getElementById('count-comparison-chart');
    
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    // Get counts
    const activeCount = activeParticipants.length;
    const stoppedCount = stoppedParticipants.length;
    const totalCount = activeCount + stoppedCount;
    
    // Skip if no data
    if (totalCount === 0) return;
    
    // Set up dimensions
    const margin = { top: 10, right: 30, bottom: 40, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = chartContainer.clientHeight - margin.top - margin.bottom - 10;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Data for the chart
    const data = [
        { 
            category: 'Continuing', 
            value: activeCount,
            percentage: (activeCount / totalCount * 100).toFixed(1)
        },
        { 
            category: 'Stopped', 
            value: stoppedCount,
            percentage: (stoppedCount / totalCount * 100).toFixed(1)
        }
    ];
    
    // X scale
    const xScale = d3.scaleLinear()
        .domain([0, d3.max([activeCount, stoppedCount]) * 1.1])
        .range([0, width]);
    
    // Y scale
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, height])
        .padding(0.3);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text')
        .style('text-anchor', 'middle');
    
    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '10px')
        .text('Number of Runners');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add bars
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('g');
    
    bars.append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.value))
        .attr('fill', d => d.category === 'Continuing' ? '#3498db' : '#e74c3c')
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners</strong><br/>
                Count: ${d.value} runners<br/>
                Percentage: ${d.percentage}% of total
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
        
    // Add count labels inside the bars if there's enough space
    bars.append('text')
        .attr('class', 'value-label')
        .attr('y', d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(d.value) > 50 ? xScale(d.value) - 40 : xScale(d.value) + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', d => xScale(d.value) > 50 ? 'white' : '#333')
        .style('font-weight', 'bold')
        .text(d => `${d.value}`);
}

// Create and update the age comparison chart
function updateAgeComparisonChart(activeParticipants, stoppedParticipants) {
    const chartContainer = document.getElementById('age-comparison-chart');
    
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    // Calculate mean ages
    const activeMeanAge = d3.mean(activeParticipants, d => d.age);
    const stoppedMeanAge = d3.mean(stoppedParticipants, d => d.age);
    
    // Skip if no data
    if (!activeMeanAge && !stoppedMeanAge) return;
    
    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = chartContainer.clientHeight - margin.top - margin.bottom - 20;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Data for the chart
    const data = [
        { 
            category: 'Continuing', 
            value: activeMeanAge || 0, 
            count: activeParticipants.length,
            stdDev: d3.deviation(activeParticipants, d => d.age) || 0
        },
        { 
            category: 'Stopped', 
            value: stoppedMeanAge || 0, 
            count: stoppedParticipants.length,
            stdDev: d3.deviation(stoppedParticipants, d => d.age) || 0
        }
    ];
    
    // X scale
    const xScale = d3.scaleLinear()
        .domain([0, d3.max([activeMeanAge || 0, stoppedMeanAge || 0]) * 1.1])
        .range([0, width]);
    
    // Y scale
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, height])
        .padding(0.3);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text')
        .style('text-anchor', 'middle');
    
    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '10px')
        .text('Age (years)');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add bars
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('g');
    
    bars.append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.value))
        .attr('fill', d => d.category === 'Continuing' ? '#3498db' : '#e74c3c')
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners</strong><br/>
                Mean Age: ${d.value.toFixed(1)} years<br/>
                Standard Deviation: ${d.stdDev.toFixed(1)}<br/>
                Count: ${d.count} runners
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
        
    // Add value labels
    bars.append('text')
        .attr('class', 'value-label')
        .attr('y', d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(d.value) > 50 ? xScale(d.value) - 40 : xScale(d.value) + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', d => xScale(d.value) > 50 ? 'white' : '#333')
        .style('font-weight', 'bold')
        .text(d => `${d.value.toFixed(1)}`);
}

// Create and update the gender comparison chart
function updateGenderComparisonChart(activeParticipants, stoppedParticipants) {
    const chartContainer = document.getElementById('gender-comparison-chart');
    
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    // Skip if no data
    if (activeParticipants.length === 0 && stoppedParticipants.length === 0) return;
    
    // Calculate gender percentages
    const activeMaleCount = activeParticipants.filter(d => d.gender === 'M').length;
    const activeFemaleCount = activeParticipants.filter(d => d.gender === 'F').length;
    const stoppedMaleCount = stoppedParticipants.filter(d => d.gender === 'M').length;
    const stoppedFemaleCount = stoppedParticipants.filter(d => d.gender === 'F').length;
    
    const activeMalePercentage = activeParticipants.length > 0 ? (activeMaleCount / activeParticipants.length) * 100 : 0;
    const activeFemalePercentage = activeParticipants.length > 0 ? (activeFemaleCount / activeParticipants.length) * 100 : 0;
    const stoppedMalePercentage = stoppedParticipants.length > 0 ? (stoppedMaleCount / stoppedParticipants.length) * 100 : 0;
    const stoppedFemalePercentage = stoppedParticipants.length > 0 ? (stoppedFemaleCount / stoppedParticipants.length) * 100 : 0;
    
    // Set up dimensions
    const margin = { top: 25, right: 30, bottom: 40, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = chartContainer.clientHeight - margin.top - margin.bottom - 20;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Data for the chart
    const data = [
        { 
            category: 'Continuing', 
            male: activeMalePercentage,
            female: activeFemalePercentage,
            maleCount: activeMaleCount,
            femaleCount: activeFemaleCount,
            total: activeParticipants.length
        },
        { 
            category: 'Stopped', 
            male: stoppedMalePercentage,
            female: stoppedFemalePercentage,
            maleCount: stoppedMaleCount,
            femaleCount: stoppedFemaleCount,
            total: stoppedParticipants.length
        }
    ];
    
    // X scale
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, width]);
    
    // Y scale
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, height])
        .padding(0.3);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text')
        .style('text-anchor', 'middle');
    
    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '10px')
        .text('Gender Percentage (%)');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add male bars
    const maleBars = svg.selectAll('.male-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.male))
        .attr('fill', '#3498db')  // Blue for males
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners - Male</strong><br/>
                Percentage: ${d.male.toFixed(1)}%<br/>
                Count: ${d.maleCount} out of ${d.total}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
    
    // Add female bars
    const femaleBars = svg.selectAll('.female-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', d => xScale(d.male))
        .attr('width', d => xScale(d.female))
        .attr('fill', '#e74c3c')  // Red for females
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners - Female</strong><br/>
                Percentage: ${d.female.toFixed(1)}%<br/>
                Count: ${d.femaleCount} out of ${d.total}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
        
    // Add labels for the percentages
    data.forEach(d => {
        // Add male percentage
        if (d.male > 10) {
            svg.append('text')
                .attr('class', 'value-label')
                .attr('y', yScale(d.category) + yScale.bandwidth() / 2)
                .attr('x', xScale(d.male / 2))
                .attr('dy', '.35em')
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('fill', 'white')
                .style('font-weight', 'bold')
                .text(`${Math.round(d.male)}% M`);
        }
        
        // Add female percentage
        if (d.female > 10) {
            svg.append('text')
                .attr('class', 'value-label')
                .attr('y', yScale(d.category) + yScale.bandwidth() / 2)
                .attr('x', xScale(d.male + d.female / 2))
                .attr('dy', '.35em')
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('fill', 'white')
                .style('font-weight', 'bold')
                .text(`${Math.round(d.female)}% F`);
        }
    });
    
    // Add legend
    const legendData = [
        { label: 'Male', color: '#3498db' },
        { label: 'Female', color: '#e74c3c' }
    ];
    
    const legend = svg.selectAll('.legend')
        .data(legendData)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${width - 100 + i * 50}, -20)`);
    
    legend.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', d => d.color);
    
    legend.append('text')
        .attr('x', 20)
        .attr('y', 7.5)
        .attr('dy', '.35em')
        .style('font-size', '11px')
        .text(d => d.label);
}

// Create and update the height comparison chart
function updateHeightComparisonChart(activeParticipants, stoppedParticipants) {
    const chartContainer = document.getElementById('height-comparison-chart');
    
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    // Calculate mean heights
    const activeMeanHeight = d3.mean(activeParticipants, d => d.height);
    const stoppedMeanHeight = d3.mean(stoppedParticipants, d => d.height);
    
    // Skip if no data
    if (!activeMeanHeight && !stoppedMeanHeight) return;
    
    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = chartContainer.clientHeight - margin.top - margin.bottom - 20;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Data for the chart
    const data = [
        { 
            category: 'Continuing', 
            value: activeMeanHeight || 0, 
            count: activeParticipants.length,
            stdDev: d3.deviation(activeParticipants, d => d.height) || 0
        },
        { 
            category: 'Stopped', 
            value: stoppedMeanHeight || 0, 
            count: stoppedParticipants.length,
            stdDev: d3.deviation(stoppedParticipants, d => d.height) || 0
        }
    ];
    
    // X scale
    const xScale = d3.scaleLinear()
        .domain([0, d3.max([activeMeanHeight || 0, stoppedMeanHeight || 0]) * 1.1])
        .range([0, width]);
    
    // Y scale
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, height])
        .padding(0.3);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text')
        .style('text-anchor', 'middle');
    
    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '10px')
        .text('Height (inches)');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add bars
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('g');
    
    bars.append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.value))
        .attr('fill', d => d.category === 'Continuing' ? '#3498db' : '#e74c3c')
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners</strong><br/>
                Mean Height: ${d.value.toFixed(1)} inches<br/>
                Standard Deviation: ${d.stdDev.toFixed(1)}<br/>
                Count: ${d.count} runners
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
        
    // Add value labels
    bars.append('text')
        .attr('class', 'value-label')
        .attr('y', d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(d.value) > 50 ? xScale(d.value) - 40 : xScale(d.value) + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', d => xScale(d.value) > 50 ? 'white' : '#333')
        .style('font-weight', 'bold')
        .text(d => `${d.value.toFixed(1)}`);
}

// Create and update the weight comparison chart
function updateWeightComparisonChart(activeParticipants, stoppedParticipants) {
    const chartContainer = document.getElementById('weight-comparison-chart');
    
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    // Calculate mean weights
    const activeMeanWeight = d3.mean(activeParticipants, d => d.weight);
    const stoppedMeanWeight = d3.mean(stoppedParticipants, d => d.weight);
    
    // Skip if no data
    if (!activeMeanWeight && !stoppedMeanWeight) return;
    
    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = chartContainer.clientHeight - margin.top - margin.bottom - 20;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Data for the chart
    const data = [
        { 
            category: 'Continuing', 
            value: activeMeanWeight || 0, 
            count: activeParticipants.length,
            stdDev: d3.deviation(activeParticipants, d => d.weight) || 0
        },
        { 
            category: 'Stopped', 
            value: stoppedMeanWeight || 0, 
            count: stoppedParticipants.length,
            stdDev: d3.deviation(stoppedParticipants, d => d.weight) || 0
        }
    ];
    
    // X scale
    const xScale = d3.scaleLinear()
        .domain([0, d3.max([activeMeanWeight || 0, stoppedMeanWeight || 0]) * 1.1])
        .range([0, width]);
    
    // Y scale
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, height])
        .padding(0.3);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll('text')
        .style('text-anchor', 'middle');
    
    // Add X axis label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 5)
        .style('font-size', '10px')
        .text('Weight (lbs)');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale));
    
    // Create tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add bars
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('g');
    
    bars.append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.category))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.value))
        .attr('fill', d => d.category === 'Continuing' ? '#3498db' : '#e74c3c')
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.category} Runners</strong><br/>
                Mean Weight: ${d.value.toFixed(1)} lbs<br/>
                Standard Deviation: ${d.stdDev.toFixed(1)}<br/>
                Count: ${d.count} runners
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1);
        });
        
    // Add value labels
    bars.append('text')
        .attr('class', 'value-label')
        .attr('y', d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr('x', d => xScale(d.value) > 50 ? xScale(d.value) - 40 : xScale(d.value) + 5)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('fill', d => xScale(d.value) > 50 ? 'white' : '#333')
        .style('font-weight', 'bold')
        .text(d => `${d.value.toFixed(1)}`);
}
