// Initialize the visualization when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    d3.csv('data/data.csv').then(rawData => {
        // Process the data to get unique participants and their max times
        const participantData = processData(rawData);
        
        // Initialize the visualization
        createVisualization(participantData, rawData);

        // Add similarity search form
        createSimilaritySearchForm(participantData);

        // Check if we need to restore scroll position and highlight
        const savedScroll = sessionStorage.getItem('timelineScroll');
        const lastViewedParticipant = sessionStorage.getItem('lastViewedParticipant');
        
        if (savedScroll || lastViewedParticipant) {
            // Wait for visualization to be fully loaded
            setTimeout(() => {
                const timeline = document.getElementById('timeline');
                
                if (lastViewedParticipant) {
                    // Find and highlight the last viewed participant
                    highlightParticipant(lastViewedParticipant, false);
                } else if (savedScroll) {
                    // Just restore the scroll position
                    timeline.scrollLeft = savedScroll;
                }
                
                // Clear the stored values
                sessionStorage.removeItem('timelineScroll');
                sessionStorage.removeItem('lastViewedParticipant');
            }, 100); // Small delay to ensure visualization is ready
        }

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
        
        const maxSpeed = d3.max(data, d => +d.Speed_mph || 0);

        // Find the latest time at which max speed occurred
        const endurance = d3.max(data.filter(d => +d.Speed_mph === maxSpeed), d => +d.time);

        return {
            id: id,
            age: +participant.Age,
            gender: participant.Sex === '1' ? 'F' : 'M', // Assuming 1 = Female, else Male
            weight: +participant.Weight_lb,
            height: +participant.Height_in,
            endurance: endurance, 
            humidity: +participant.Humidity,
            temperature: +participant.Temperature,
            maxHR: d3.max(data, d => +d.HR || 0),
            maxSpeed: maxSpeed,
            timeSeriesData: data.map(d => ({
                time: +d.time,
                speed: +d.Speed_mph || 0,
                hr: +d.HR || 0,
                vo2: +d.VO2 || 0,
                vco2: +d.VCO2 || 0,
                rr: +d.RR || 0,
                ve: +d.VE || 0
            })).sort((a, b) => a.time - b.time)
        };
    });

    return participants;
}

function createVisualization(participants, rawData) {

    // Add loading state at the start
    const timelineContainer = document.getElementById('timeline');
    timelineContainer.style.opacity = '0';
    timelineContainer.style.transition = 'opacity 0.5s ease-in';

    // Set up dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
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
        .attr('height', 500)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const shading = timelineSvg.append('rect')
        .attr('class', 'shading')
        .attr('x', 0)
        .attr('y', -margin.top)
        .attr('width', 0)  // Initially set width to 0
        .attr('height', height + 200 + margin.bottom)
        .style('fill', 'rgba(160, 160, 160, 0.1)') // Light shading
        .style('pointer-events', 'none'); // Make sure it doesn't interfere with interaction

    // Group participants by their endurance time (rounded to nearest 5 seconds)
    const timeGroups = d3.group(participants, d => Math.round(d.endurance / 5) * 5);

    // Set dynamic spacing based on stack size
    const verticalSpacing = 25; // Adjust as needed to avoid overlap

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
        .domain([-1, d3.max(participants, d => d.endurance) + 10]) 
        .range([0, width]);

    // Define an array of text objects with their start and end times
    const textsToDisplay = [
        { text: "A maximal graded exercise test is a physical assessment in which an individual performs progressively intense exercise until reaching voluntary exhaustion or physiological limits.", start: 60, end: 140, type: 1 },
        { text: "These tests allow researchers to evaluate cardiovascular, respiratory, and metabolic responses to maximal exertion.", start: 160, end: 220, type: 1 },
        { text: "As you scroll, pay attention to the progressively increasing speed. These exercise tests typically began with a 3 mph warm-up walk, followed by speed increments of either 0.3 or 0.6 mph.", start: 250, end: 320, type: 1 },
        { text: "Each icon represents a participant who has reached their maximum effort—blue for males and pink for females. As we approach the 7-minute mark, the first group of participants reaches their limit. Hover over an icon for a brief description, or click to explore detailed insights.", start: 350, end: 450, type: 1 },
        { text: "Approaching the 9-minute mark, more and more participants reach their maximum effort. Hover over the dynamic bars on the bottom to view the exact numbers.", start: 510, end: 600, type: 1 },
        { text: "At 12 minutes and 48 seconds, approximately 25% of participants have reached their physiological limits.", start: 715, end: 765, type: 2},
        { text: "As we approach 14 minutes, waves of participants reach their limits. Scroll up to view all the data.", start: 825, end: 885, type: 2 },
        { text: "Runners who are still active at the 18-minute mark are in the 90th percentile of this study.", start: 1070, end: 1110, type: 2 },
        { text: "Achieving an endurance time of 19:48, Runner #395 is our last standing female participant. Approximately 5% of male participants remain at this point.", start: 1175, end: 1230, type: 1 },
        { text: "This leading group of male participants persists for approximately five more minutes. ", start: 1270, end: 1350, type: 1 },
        { text: "The longest recorded endurance time in this study is 24:52. These results highlight a significant biological advantage in men, particularly in terms of endurance and overall physical performance.", start: 1400, end: 1510, type: 1 }


    ];

    // Function to update the anchored text based on currentTime
    function updateAnchoredText(currentTime) {
        // Find the active text object for the current time
        const activeEntry = textsToDisplay.find(entry => 
            currentTime >= entry.start && currentTime <= entry.end
        );

        if (activeEntry) {

            const anchoredText = document.getElementById(
                activeEntry.type === 1 ? 'anchored-text-m' : 'anchored-text-t'
            );

            let progress = (currentTime - activeEntry.start) / (activeEntry.end - activeEntry.start);
            progress = Math.min(progress * 1.5, 1);

            let translateValue = 100 + (-150) * progress;

            // Update the content and fade in the text
            anchoredText.innerHTML = `<p>${activeEntry.text}</p>`;
            anchoredText.style.opacity = 1;
            anchoredText.style.transform = "translateX(" + translateValue + "%)";

        } else {
            // Hide the text if not within any interval
            document.getElementById('anchored-text-m').style.opacity = 0;
            document.getElementById('anchored-text-t').style.opacity = 0;
        }
    }

    function updateAverageSpeed(currentTime) {
        const speed = document.getElementById('speed');
    
        const tolerance = 1; 

        const activeParticipants = participants.filter(p => currentTime <= p.endurance);
    
        const validSpeeds = activeParticipants.flatMap(p => 
            p.timeSeriesData
                .filter(d => Math.abs(d.time - currentTime) <= tolerance) // Find closest time data
                .map(d => d.speed)
        );
    
        if (activeParticipants.length > 0 && validSpeeds.length > 0) {
            const avgSpeed = d3.sum(validSpeeds) / validSpeeds.length;

            speed.textContent = `${avgSpeed.toFixed(2)} mph`;

        } else {
            speed.textContent = "N/A";
        }        
    }
    

    // Update time indicator based on scroll position
    function updateTimeIndicator() {
        const scrollRatio = timelineContainer.scrollLeft / (timelineContainer.scrollWidth - timelineContainer.clientWidth);
        const currentTime = scrollRatio * d3.max(participants, d => d.endurance + 10);
    
        // Update the shading width to match the current time
        shading.attr('width', xScale(currentTime));

        // Update the time display
        const time = document.getElementById('time');

        time.textContent = String(Math.floor(currentTime / 60)).padStart(2, '0') + 
        ':' + String(Math.floor(currentTime % 60)).padStart(2, '0');
        
        // update speed display
        updateAverageSpeed(currentTime);

        updateAnchoredText(currentTime);

        // Update visualizations based on current time
        createStackedBarChart(participants, currentTime);

        // updateAllCharts(participants, currentTime);
        getAverageStats(participants, currentTime);

    }

    // Add grid lines
    timelineSvg.selectAll('.grid-line')
        .data(d3.range(0, d3.max(participants, d => d.endurance + 10), 5))
        .enter()
        .append('line')
        .attr('class', 'grid-line')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', 0 - margin.top)
        .attr('y2', height + 120 + margin.bottom)
        .style('stroke', 'rgba(0, 0, 0, 0.05)')
        .style('stroke-width', 1);

    timelineSvg.selectAll('.time-label')
        .data(d3.range(0, d3.max(participants, d => d.endurance + 10), 15))
        .join('text')
        .attr('class', 'time-label')
        .attr('x', d => xScale(d))
        .attr('y', height + 199) // Bottom labels
        .attr('text-anchor', 'middle')
        .text(d => {
            const minutes = String(Math.floor(d / 60)).padStart(2, '0');
            const seconds = String(d % 60).padStart(2, '0');
            return `${minutes}:${seconds}`;
    });
    
    timelineSvg.selectAll('.time-top-label')
        .data(d3.range(0, d3.max(participants, d => d.endurance + 10), 15))
        .join('text')
        .attr('class', 'time-label')
        .attr('x', d => xScale(d))
        .attr('y', -5) // Adjust this for better positioning
        .attr('text-anchor', 'middle')
        .text(d => {
            const minutes = String(Math.floor(d / 60)).padStart(2, '0');
            const seconds = String(d % 60).padStart(2, '0');
            return `${minutes}:${seconds}`;
    });
    

    timelineSvg.append('foreignObject')
        .attr('class', 'text-box')  // Add class to the foreignObject
        .attr('transform', 'translate(100, 240)')
        .append('xhtml:div')  // Use 'xhtml' to access HTML elements inside SVG
        .attr('class', 'text-box-content')  // Add a separate class to the content div
        .html('<p>Between 2008 and 2018, researchers at the University of Málaga conducted graded exercise tests (GETs) to investigate how respiratory systems perform under extreme physical exertion. Our webpage presents the results of 819 participants. Scroll to the right to explore!</p>');
        
    const iconSize = 22;  // Size of the icon
    const dots = timelineSvg.selectAll('.runner-group')
        .data(stackedParticipants)
        .enter()
        .append('g')  // Wrap each image in a <g> element
        .attr('class', 'runner-group') 
        .attr('data-id', d => d.id)
        .attr('transform', d => 
            `translate(${xScale(Math.round(d.endurance / 5) * 5) - iconSize / 2}, 
                    ${(height + 185) - (d.stackIndex + 1) * verticalSpacing})`
        );

    dots.append('image')
        .attr('class', 'runner') 
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('xlink:href', d => d.gender === 'F' ? 'icons/female-icon.svg' : 'icons/male-icon.svg')
        .style('opacity', 1);


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
            Weight: ${d.weight.toFixed(1)} lbs<br/>
            Height: ${d.height.toFixed(1)} in<br/>
            Max HR: ${d.maxHR} bpm<br/>
            Max Speed: ${d.maxSpeed.toFixed(2)} mph<br/>
            Endurance: ${String(Math.floor(d.endurance / 60)).padStart(2, '0')}:${String(d.endurance % 60).padStart(2, '0')}
        `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');

        d3.select(event.target)
            .transition()
            .duration(200)
            .style('filter', 'brightness(1.5)'); 
    })
    .on('mouseout', (event) => {
        tooltip.transition()
            .duration(500)
            .style('opacity', 0);

        d3.select(event.target)
            .transition()
            .duration(200)
            .style('filter', 'brightness(1)'); 
    })
    .on('click', (event, d) => {
        window.location.href = `participant.html?id=${d.id}`;
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
        .attr('y2', height + 200);

    milestoneMarkers.append('text')
        .attr('class', 'milestone-text')
        .attr('x', 10) 
        .attr('y', 180)  
        .attr('dy', '0.35em')  // Vertical alignment for better positioning
        .style('text-anchor', 'start')  // Align text starting point to the left
        .text(d => d.description);

    // After everything is set up, fade in the timeline
    requestAnimationFrame(() => {
        timelineContainer.scrollTop = timelineContainer.scrollHeight;
        timelineContainer.scrollLeft = 0;
        timelineContainer.style.opacity = '1';
    });

}


function calculateMilestones(data) {
    const sortedEndurance = data.map(d => d.endurance).sort((a, b) => a - b);
    const totalParticipants = sortedEndurance.length;
    
    return [
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.25)],
            description: "25th percentile"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.5)],
            description: "50th percentile"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.75)],
            description: "75th percentile"
        },
        {
            time: sortedEndurance[Math.floor(totalParticipants * 0.9)],
            description: "90th percentile"
        }
    ];
}

function createStackedBarChart(participants, currentTime) {
    function renderChart() {
        const totalParticipants = participants.length;

        const activeParticipants = participants.filter(p => p.endurance >= currentTime);
        const inactiveParticipants = participants.filter(p => p.endurance < currentTime);

        const genderBreakdown = {
            active: {
                male: activeParticipants.filter(p => p.gender === 'M').length,
                female: activeParticipants.filter(p => p.gender === 'F').length
            },
            inactive: {
                male: inactiveParticipants.filter(p => p.gender === 'M').length,
                female: inactiveParticipants.filter(p => p.gender === 'F').length
            }
        };

        const percentActiveFemale = (genderBreakdown.active.female / (genderBreakdown.active.female + genderBreakdown.inactive.female)) * 100;
        const percentActiveMale = (genderBreakdown.active.male / (genderBreakdown.active.male + genderBreakdown.inactive.male)) * 100;
        const percentInactiveFemale = (genderBreakdown.inactive.female / (genderBreakdown.active.female + genderBreakdown.inactive.female)) * 100;
        const percentInactiveMale = (genderBreakdown.inactive.male / (genderBreakdown.active.male + genderBreakdown.inactive.male)) * 100;

        const data = [
            { category: 'Active', 
                male: genderBreakdown.active.male, 
                female: genderBreakdown.active.female,
                percentFemale: percentActiveFemale.toFixed(1),
                percentMale: percentActiveMale.toFixed(1)
            },
            { category: 'Inactive', 
                male: genderBreakdown.inactive.male, 
                female: genderBreakdown.inactive.female,
                percentFemale: percentInactiveFemale.toFixed(1),
                percentMale: percentInactiveMale.toFixed(1) 
            }
        ];

        // Get container dimensions
        const container = d3.select('#active-chart');
        const width = container.node().clientWidth;
        const height = container.node().clientHeight;

        const margin = { top: 20, right: 110, bottom: 50, left: 80 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Select or create SVG
        const svg = container.selectAll('svg')
            .data([null])
            .join('svg')
            .attr('width', width)
            .attr('height', height);

        // Add or select the chart group
        let chartGroup = svg.select('.chart-group');
        if (chartGroup.empty()) {
            chartGroup = svg.append('g')
                .attr('class', 'chart-group')
                .attr('transform', `translate(${margin.left},${margin.top})`);
        }

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, totalParticipants])
            .range([0, chartWidth]);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.category))
            .range([0, chartHeight])
            .padding(0.5);

        // Axes
        const proportionTicks = Array.from({ length: 6 }, (_, i) => (i / 5) * totalParticipants);

        const xAxis = d3.axisBottom(xScale)
            .tickValues(proportionTicks)
            .tickSize(4)
            .tickFormat(d => `${((d / totalParticipants) * 100).toFixed(0)}%`);

        // Append x-axis if not exists
        let xAxisGroup = chartGroup.select('.x-axis');
        if (xAxisGroup.empty()) {
            xAxisGroup = chartGroup.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0, ${chartHeight})`);
        }
        xAxisGroup.call(xAxis);

        // Append x-axis label if not exists
        let xAxisLabel = chartGroup.select('.x-axis-label');
        if (xAxisLabel.empty()) {
            xAxisLabel = chartGroup.append('text')
                .attr('class', 'x-axis-label')
                .style('font-size', '0.9em')
                .attr('text-anchor', 'middle')
                .attr('y', chartHeight + 40)  // Positioning below the x-axis
                .style('fill', '#333')
                .text('Proportion');
        }
        // Update x-axis label position on resize
        xAxisLabel
            .attr('x', chartWidth / 2)  // Ensure it is always in the middle
            .attr('y', chartHeight + 30);  // Ensure it is positioned below the x-axis

        const yAxis = d3.axisLeft(yScale).tickSize(4);

        // Append y-axis if not exists
        let yAxisGroup = chartGroup.select('.y-axis');
        if (yAxisGroup.empty()) {
            yAxisGroup = chartGroup.append('g')
                .attr('class', 'y-axis')
        }
        yAxisGroup.call(yAxis);

        // Bar groups
        const groups = chartGroup.selectAll('.bar-group')
            .data(data)
            .join('g')
            .attr('class', 'bar-group')
            .attr('transform', d => `translate(0, ${yScale(d.category)})`);

        // Female bars
        groups.selectAll('.female-bar')
            .data(d => [d])
            .join('rect')
            .attr('class', 'female-bar')
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('fill', '#ee72c4')
            .attr('width', d => xScale(d.female));

        
        // Male bars
        groups.selectAll('.male-bar')
            .data(d => [d])
            .join('rect')
            .attr('class', 'male-bar')
            .attr('x', d => xScale(d.female))
            .attr('height', yScale.bandwidth())
            .attr('fill', '#28ace4')
            .attr('width', d => xScale(d.male));

        // Total labels
        groups.selectAll('.total-label')
            .data(d => [d])
            .join('text')
            .attr('class', 'total-label')
            .attr('x', d => xScale(d.female + d.male) + 5)
            .attr('y', yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '0.8em')
            .attr('fill', '#333')
            .text(d => `${d.female + d.male} (${((d.female + d.male) / totalParticipants * 100).toFixed(1)}%)`);

            // Tooltip setup
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', '#fff')
            .style('padding', '5px 10px')
            .style('border', '1px solid #333')
            .style('border-radius', '5px')
            .style('display', 'none')
            .style('color', '#333');

            // Adding mouseover and mouseout events to the female bars
        groups.selectAll('.female-bar')
            .on('mouseover', (event, d) => {
                // Brighten the bar by changing the fill color
                d3.select(event.target)
                    .style('fill', '#ffd7ef');  // Adjust the color to your liking

                // Show the tooltip
                tooltip.style('display', 'block')
                    .html(`
                        Female: <b>${d.female}</b> <br>
                        % of Female: <b>${d.percentFemale}%</b>
                    `)
                    .style('left', `${event.pageX + 10}px`)  // Add 10px offset from the mouse
                    .style('top', `${event.pageY - 20}px`); // Add 20px offset above the mouse
            })
            .on('mouseout', (event) => {
                // Reset the bar color on mouseout
                d3.select(event.target)
                    .style('fill', '#ee72c4');  // Reset to original color

                // Hide the tooltip
                tooltip.style('display', 'none');
            });

        groups.selectAll('.male-bar')
            .on('mouseover', (event, d) => {
                // Brighten the bar by changing the fill color
                d3.select(event.target)
                    .style('fill', '#b3e0ff');  // Adjust the color to your liking
        
                // Show the tooltip
                tooltip.style('display', 'block')
                    .html(`
                        Male: <b>${d.male}</b> <br>
                        % of Male: <b>${d.percentMale}%</b>
                    `)
                    .style('left', `${event.pageX + 10}px`)  // Add 10px offset from the mouse
                    .style('top', `${event.pageY - 20}px`); // Add 20px offset above the mouse
            })
            .on('mouseout', (event) => {
                // Reset the bar color on mouseout
                d3.select(event.target)
                    .style('fill', '#28ace4');  // Reset to original color
        
                // Hide the tooltip
                tooltip.style('display', 'none');
            });
    }

    // Initial render
    renderChart();

    // Add ResizeObserver for dynamic resizing
    const containerElement = document.getElementById('active-chart');
    const resizeObserver = new ResizeObserver(() => renderChart());
    resizeObserver.observe(containerElement);
}


function getAverageStats(participants, currentTime) {


    const activeParticipants = participants.filter(p => p.endurance >= currentTime);
    const inactiveParticipants = participants.filter(p => p.endurance < currentTime);

    // get average age, weight, and height for active and inactive participants
    const averageAge = d3.mean(activeParticipants, d => d.age);
    const averageWeight = d3.mean(activeParticipants, d => d.weight);
    const averageHeight = d3.mean(activeParticipants, d => d.height);

    const averageAgeInactive = d3.mean(inactiveParticipants, d => d.age);
    const averageWeightInactive = d3.mean(inactiveParticipants, d => d.weight);
    const averageHeightInactive = d3.mean(inactiveParticipants, d => d.height);

    d3.select('#active-stats').html('');
    d3.select('#inactive-stats').html('');

    // Create new dl, dt, dd elements for active stats
    const active_dl = d3.select('#active-stats').append('dl');
    
    active_dl.append('dt').text('Avg Age');
    active_dl.append('dd').text(averageAge != null ? averageAge.toFixed(1) : '—');

    active_dl.append('dt').text('Avg Weight (lbs)');
    active_dl.append('dd').text(averageWeight != null ? averageWeight.toFixed(1) : '—');

    active_dl.append('dt').text('Avg Height (in)');
    active_dl.append('dd').text(averageHeight != null ? averageHeight.toFixed(1) : '—');

    // Create new dl, dt, dd elements for inactive stats
    const inactive_dl = d3.select('#inactive-stats').append('dl');
    inactive_dl.append('dt').text('Avg Age');
    inactive_dl.append('dd').text(averageAgeInactive != null ? averageAgeInactive.toFixed(1) : '—');

    inactive_dl.append('dt').text('Avg Weight (lbs)');
    inactive_dl.append('dd').text(averageWeightInactive != null ? averageWeightInactive.toFixed(1) : '—');

    inactive_dl.append('dt').text('Avg Height (in)');
    inactive_dl.append('dd').text(averageHeightInactive != null ? averageHeightInactive.toFixed(1) : '—');

}

function createSimilaritySearchForm(participants) {

    // Add form submission handler
    document.getElementById('similarityForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const userProfile = {
            age: +document.getElementById('age').value,
            weight: +document.getElementById('weight').value,
            height: +document.getElementById('height').value,
            gender: document.getElementById('gender').value
        };

        const similarParticipant = findSimilarParticipant(userProfile, participants);
        
        // Store the current scroll position in sessionStorage
        const timeline = document.getElementById('timeline');
        sessionStorage.setItem('timelineScroll', timeline.scrollLeft);
    });
}

function findSimilarParticipant(userProfile, participants) {
    // Normalize the ranges for each metric
    const maxAge = d3.max(participants, p => p.age);
    const maxWeight = d3.max(participants, p => p.weight);
    const maxHeight = d3.max(participants, p => p.height);

    // Calculate similarity scores
    const scores = participants.map(participant => {
        // Only consider participants of the same gender
        if (participant.gender !== userProfile.gender) {
            return { participant, score: Infinity };
        }

        // Calculate normalized Euclidean distance
        const ageDiff = Math.abs(participant.age - userProfile.age) / maxAge;
        const weightDiff = Math.abs(participant.weight - userProfile.weight) / maxWeight;
        const heightDiff = Math.abs(participant.height - userProfile.height) / maxHeight;

        // Weighted sum of differences (can adjust weights based on importance)
        const score = Math.sqrt(
            Math.pow(ageDiff, 2) +
            Math.pow(weightDiff, 2) +
            Math.pow(heightDiff, 2)
        );

        return { participant, score };
    });

    // Sort by similarity score and return the most similar participant
    scores.sort((a, b) => a.score - b.score);
    const similarParticipant = scores[0].participant;

    // Scroll to the participant's position and highlight it
    highlightParticipant(similarParticipant.id, true);
    
    return similarParticipant;
}

document.getElementById('similarityForm').addEventListener('input', (e) => {
    const input = e.target;

    // Check if the input is valid
    if (input.type === 'number') {
        const value = Number(input.value);

        // Define valid ranges
        const min = Number(input.min);
        const max = Number(input.max);

        // Apply styles dynamically for better UX
        if (value < min || value > max || isNaN(value)) {
            input.style.backgroundColor = '#f5c6d1';
        } else {
            input.style.backgroundColor = '#c2e0cc';
        }
    }
});


function highlightParticipant(participantId, isSearch) {
    const timeline = document.getElementById('timeline');
    const participantGroup = d3.select(`g[data-id="${participantId}"]`);
    
    // Check if participantGroup is correctly selected
    if (!participantGroup.node()) {
        console.log("Participant group not found");
        return;
    }

    const participantTransform = participantGroup.attr('transform');
    
    // Check if the 'transform' attribute exists and matches the pattern
    if (!participantTransform) {
        console.log("No transform attribute found for participant");
        return;
    }

    const participantX = +participantTransform.match(/translate\(([\d.]+)/)[1];
    
    // Log the participantX value to ensure it's correct
    console.log("Participant X position: ", participantX);

    // Scroll to the participant's position
    timeline.scrollLeft = participantX - (timeline.clientWidth / 2);

    // Add highlight effect with smooth scaling
    participantGroup
        .style('transition', 'transform 0.3s ease, filter 0.3s ease')
        .style('filter', 'brightness(1.5) drop-shadow(0 0 10px #fff)')
        .attr('transform', participantGroup.attr('transform') + ' scale(1.5)');

    // Cleanly remove highlight effect after 3 seconds
    setTimeout(() => {
        participantGroup
            .style('filter', null)
            .attr('transform', participantGroup.attr('transform').replace(' scale(1.5)', ''));
    }, 3000);

    // If isSearch is true, display the text next to the icon
    if (isSearch) {
        const similarParticipant = participantGroup.datum(); // Get the participant data

        // Log participant data to ensure it's being accessed correctly
        console.log("Similar Participant Data: ", similarParticipant);

        window.scrollTo({
            top: 20,
            behavior: 'smooth'  // Makes the scroll smooth
        });

        // Create the message element
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('similar-participant-message');
        messageDiv.innerHTML = `Participant #${similarParticipant.id} is your closest match. Click the icon to learn more!`;

        // Style the message (You can adjust these styles as needed)
        const participantRect = participantGroup.node().getBoundingClientRect();

        console.log("Participant Rect: ", participantRect);

        messageDiv.style.position = 'absolute';
        messageDiv.style.left = `${participantRect.x + 35}px`; // Position to the right of the icon
        messageDiv.style.top = `${participantRect.y + window.scrollY - 35}px`; // Align vertically with the icon
        messageDiv.style.padding = '10px';
        messageDiv.style.marginTop = '20px';
        messageDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
        messageDiv.style.border = '1px solid rgba(221, 221, 221, 0.7)';
        messageDiv.style.width = '300px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.color = '#333';
        messageDiv.style.fontSize = '1em;';
        messageDiv.style.zIndex = '1000'; // Ensure it's on top of other elements

        // Append the message to the body
        document.body.appendChild(messageDiv);

        // Set a timer to remove the message after 5 seconds (5000 ms)
        setTimeout(() => {
            messageDiv.remove();  // Remove the message after 5 seconds
        }, 5000);
    }
}





