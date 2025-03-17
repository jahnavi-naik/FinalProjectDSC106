// Initialize the visualization when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load the CSV data
    d3.csv('data/data.csv').then(rawData => {
        // Process the data to get unique participants and their max times
        const participantData = processData(rawData);
        
        // Initialize the visualization
        createVisualization(participantData, rawData);

        // Add similarity search form
        // createSimilaritySearchForm(participantData);

        // Check if we need to restore scroll position and highlight
        const savedScroll = sessionStorage.getItem('timelineScroll');
        const lastViewedParticipant = sessionStorage.getItem('lastViewedParticipant');
        
        if (savedScroll || lastViewedParticipant) {
            // Wait for visualization to be fully loaded
            setTimeout(() => {
                const timeline = document.getElementById('timeline');
                
                if (lastViewedParticipant) {
                    // Find and highlight the last viewed participant
                    highlightParticipant(lastViewedParticipant);
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
        .attr('height', height + 120 + margin.bottom)
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
        { text: "Approaching the 9-minute mark, more and more participants reach their maximum effort, with a majority being women.", start: 510, end: 600, type: 1 },
        { text: "At 12 minutes and 48 seconds, approximately 25% of participants have reached their physiological limits.", start: 715, end: 765, type: 2},
        { text: "As we approach 14 minutes, waves of participants end the test. Scroll up to view all the data.", start: 825, end: 885, type: 2 },
        { text: "Runners who are still active at the 18-minute mark are in the 90th percentile of this study.", start: 1070, end: 1110, type: 2 },
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
        .attr('y', height + 119) // Bottom labels
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
        .attr('transform', 'translate(100, 190)')
        .append('xhtml:div')  // Use 'xhtml' to access HTML elements inside SVG
        .attr('class', 'text-box-content')  // Add a separate class to the content div
        .html('<p>Between 2008 and 2018, researchers at the University of Málaga conducted graded exercise tests (GETs) to investigate how respiratory systems perform under extreme physical exertion. Our webpage presents the results of 819 participants. Scroll to the right to explore!</p>');
        
    const iconSize = 22;  // Size of the icon
    const dots = timelineSvg.selectAll('.runner')
        .data(stackedParticipants)
        .enter()
        .append('image')
        .attr('class', 'runner')
        .attr('data-id', d => d.id)
        .attr('x', d => xScale(Math.round(d.endurance / 5) * 5) - iconSize / 2)
        .attr('y', d => (height+ 100) - (d.stackIndex + 1) * verticalSpacing)  
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
        .attr('y2', height + 120);

    milestoneMarkers.append('text')
        .attr('class', 'milestone-text')
        .attr('x', 10) 
        .attr('y', 100)  
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

    // Get the container size dynamically
    const container = d3.select('#active-chart');
    const width = container.node().clientWidth; // Get width of the container
    const height = container.node().clientHeight;

    // Set margins and chart dimensions
    const margin = { top: 20, right: 110, bottom: 50, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Check if this is the first time creating the chart
    const isFirstLoad = !d3.select('#active-chart svg').size();

    // Only clear SVG on first load
    if (isFirstLoad) {
        d3.select('#active-chart').html('');
    }

    const svg = d3.select('#active-chart')
        .selectAll('svg')
        .data([null])
        .join('svg')
        .attr('width', width)
        .attr('height', height);

    // Add or select the chart group
    let chartGroup = svg.select('.chart-group');
    
    // If first load, create the chart group, otherwise use existing
    if (chartGroup.empty()) {
        chartGroup = svg.append('g')
            .attr('class', 'chart-group')
            .attr('transform', `translate(${margin.left},${margin.top})`);
    }

    const xScale = d3.scaleLinear()
        .domain([0, totalParticipants])
        .range([0, chartWidth]);

    const yScale = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, chartHeight])
        .padding(0.5);

    // Create x-axis with proportion ticks at 0.2 intervals
    const proportionTicks = [];
    for (let i = 0; i <= 10; i += 2) {
        proportionTicks.push(totalParticipants * (i / 10)); // This is still in raw count values
    }

    const xAxis = d3.axisBottom(xScale)
        .tickValues(proportionTicks)
        .tickSize(4)
        .tickFormat(d => {
            const proportion = d / totalParticipants;  // Convert to proportion (0.0 to 1.0)
            return `${(proportion * 100).toFixed(0)}%`;  // Convert proportion to percentage (e.g., 0.1 -> 10%)
        });

    // Add x-axis (only on first load)
    if (isFirstLoad) {
        chartGroup.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${chartHeight})`)
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'middle')
            .style('font-size', '1.3em')
            .attr('dy', '0.8em');

        // Add x-axis label
        chartGroup.append('text')
            .attr('class', 'x-axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', chartWidth / 2)
            .attr('y', chartHeight + 30)
            .style('font-size', '0.9em')
            .text('Proportion');

        // Add y-axis for category labels
        const yAxis = d3.axisLeft(yScale)
                        .tickSize(4);

        
        chartGroup.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .selectAll('text')
            .style('text-transform', 'uppercase')
            .style('font-size', '1.2em');
            
    } else {
        // Update existing axes when scrolling
        chartGroup.select('.x-axis').call(xAxis);
    }

    // Update x-axis label position dynamically
    chartGroup.select('.x-axis-label')
        .attr('x', chartWidth / 2);  // Recalculate position based on current chart width

    // Create the bar groups (this part doesn't change)
    const groups = chartGroup.selectAll('.bar-group')
        .data(data)
        .join(
            enter => enter.append('g')
                .attr('class', 'bar-group')
                .attr('transform', d => `translate(0, ${yScale(d.category)})`)
        );

    // Add female bars (pink)
    groups.selectAll('.female-bar')
        .data(d => [d])
        .join(
            enter => {
                const bars = enter.append('rect')
                    .attr('class', 'female-bar')
                    .attr('x', 0)
                    .attr('height', yScale.bandwidth())
                    .attr('fill', '#ee72c4');
                
                // Only animate on first load
                if (isFirstLoad) {
                    bars.attr('width', 0)
                        .transition().duration(500)
                        .attr('width', d => xScale(d.female));
                } else {
                    bars.transition().duration(800)
                        .attr('width', d => xScale(d.female))
                        .transition().duration(800);

                }
                return bars;
            },
            update => update
                .attr('width', d => xScale(d.female))
        );

    // Add male bars (blue)
    groups.selectAll('.male-bar')
        .data(d => [d])
        .join(
            enter => {
                const bars = enter.append('rect')
                    .attr('class', 'male-bar')
                    .attr('x', d => xScale(d.female))
                    .attr('height', yScale.bandwidth())
                    .attr('fill', '#28ace4');
                
                // Only animate on first load
                if (isFirstLoad) {
                    bars.attr('width', 0)
                        .transition().duration(500)
                        .attr('width', d => xScale(d.male));
                } else {
                    bars.attr('width', d => xScale(d.male));
                }
                return bars;
            },
            update => update
                .attr('x', d => xScale(d.female)) 
                .attr('width', d => xScale(d.male))
        );

    groups.selectAll('.total-label')
        .data(d => [d])
        .join(
            enter => enter.append('text')
                .attr('class', 'total-label')
                .attr('x', d => xScale(d.female + d.male) + 5) // Position 5px to the right of the total bar
                .attr('y', yScale.bandwidth() / 2) // Center vertically
                .attr('dy', '0.35em') // Fine-tune vertical alignment
                .attr('font-size', '0.8em')
                .attr('fill', '#333')
                .text(d => `${d.female + d.male} (${((d.female + d.male) / totalParticipants * 100).toFixed(1)}%)`),
            update => update
                .transition().duration(50)
                .attr('x', d => xScale(d.female + d.male) + 5)
                .text(d => `${d.female + d.male} (${((d.female + d.male) / totalParticipants * 100).toFixed(1)}%)`)
        );
    
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background', '#fff')
        .style('padding', '5px 10px')
        .style('border', '1px solid', '#333')
        .style('border-radius', '5px')
        .style('display', 'none')
        .style('color', '#333');
    
    groups.selectAll('.female-bar')
        .on('mouseover', (event, d) => {
            // Brighten the bar by changing the fill color
            d3.select(event.target)
                .style('fill', '#ffd7ef');  // Adjust the color to your liking
    
            tooltip.style('display', 'block')
                .html(`
                    Female: <b>${d.female}</b> <br>
                    % of Female: <b>${d.percentFemale}%</b>
                `)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 20}px`);
        })
        .on('mouseout', (event) => {
            // Reset the bar color when mouseout
            d3.select(event.target)
                .style('fill', '#ee72c4'); 
    
            tooltip.style('display', 'none');
        });
    
    groups.selectAll('.male-bar')
        .on('mouseover', (event, d) => {
            // Brighten the bar by changing the fill color
            d3.select(event.target)
                .style('fill', '#ade4ff');  // Adjust the color to your liking
    
            tooltip.style('display', 'block')
                .html(`
                    Male: <b>${d.male}</b> <br>
                    % of Male: <b>${d.percentMale}%</b>
                `)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 20}px`);
        })
        .on('mouseout', (event) => {
            // Reset the bar color when mouseout
            d3.select(event.target)
                .style('fill', '#28ace4');  
            tooltip.style('display', 'none');
        });
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



// function createMetricChart(chartConfig) {
//     const {
//         metricName,         // 'age', 'height', or 'weight'
//         chartId,            // 'age-chart', 'height-chart', or 'weight-chart'
//         axisLabel,         
//         participants,
//         currentTime
//     } = chartConfig;

//     const activeParticipants = participants.filter(p => p.endurance >= currentTime);
//     const inactiveParticipants = participants.filter(p => p.endurance < currentTime);

//     const averageMetric = {
//         active: d3.mean(activeParticipants, d => d[metricName]) || 0,
//         inactive: d3.mean(inactiveParticipants, d => d[metricName]) || 0
//     };

//     // Create data with proper metric name as property
//     const data = [
//         { category: 'Active', [metricName]: averageMetric.active },
//         { category: 'Inactive', [metricName]: averageMetric.inactive }
//     ];

//     const margin = { top: 10, right: 10, bottom: 30, left: 60 };
//     const width = 300;
//     const height = 150;
//     const chartWidth = width - margin.left - margin.right;
//     const chartHeight = height - margin.top - margin.bottom;

//     const isFirstLoad = !d3.select(`#${chartId} svg`).size();

//     if (isFirstLoad) {
//         d3.select(`#${chartId}`).html('');
//     }

//     const svg = d3.select(`#${chartId}`)
//         .selectAll('svg')
//         .data([null])
//         .join('svg')
//         .attr('width', width)
//         .attr('height', height);

//     let chartGroup = svg.select('.chart-group');
    
//     if (chartGroup.empty()) {
//         chartGroup = svg.append('g')
//             .attr('class', 'chart-group')
//             .attr('transform', `translate(${margin.left},${margin.top})`);
//     }

//     const xScale = d3.scaleLinear()
//         .domain([0, d3.max(data, d => d[metricName]) || 1]) // Ensure scale is valid
//         .range([0, chartWidth]);

//     const yScale = d3.scaleBand()
//         .domain(data.map(d => d.category))
//         .range([0, chartHeight])
//         .padding(0.5);

//     const xAxis = d3.axisBottom(xScale)
//         .ticks(5)

//     if (isFirstLoad) {
//         chartGroup.append('g')
//             .attr('class', 'x-axis')
//             .attr('transform', `translate(0, ${chartHeight})`)
//             .call(xAxis);

//         chartGroup.append('text')
//             .attr('class', 'x-axis-label')
//             .attr('text-anchor', 'middle')
//             .attr('x', chartWidth / 2)
//             .attr('y', chartHeight + margin.bottom)
//             .style('font-size', '10px')
//             .text(axisLabel);

//         const yAxis = d3.axisLeft(yScale);

//         chartGroup.append('g')
//             .attr('class', 'y-axis')
//             .call(yAxis);
//     } else {
//         chartGroup.select('.x-axis').call(xAxis);
//     }

//     const groups = chartGroup.selectAll('.bar-group')
//         .data(data)
//         .join(
//             enter => enter.append('g')
//                 .attr('class', 'bar-group')
//                 .attr('transform', d => `translate(0, ${yScale(d.category)})`)
//         );

//     const barClass = `${metricName}-bar`;
    
//     groups.selectAll(`.${barClass}`)
//         .data(d => [d])
//         .join(
//             enter => enter.append('rect')
//                 .attr('class', barClass)
//                 .attr('x', 0)
//                 .attr('height', yScale.bandwidth())
//                 .attr('fill', d => d.category === 'Active' ? '#6c90b0' : '#76323f') // Green for active, red for inactive
//                 .attr('width', 0) // Start with width 0 for animation
//                 .transition().duration(500)
//                 .attr('width', d => xScale(d[metricName])),
//             update => update
//                 .attr('fill', d => d.category === 'Active' ? '#6c90b0' : '#76323f') // Also update color on data changes
//                 .transition().duration(500)
//                 .attr('width', d => xScale(d[metricName]))
//         );

//     // Add text labels on the bars
//     const labelClass = `${metricName}-label`;

//     groups.selectAll(`.${labelClass}`)
//     .data(d => [d])
//     .join(
//         enter => enter.append('text')
//             .attr('class', labelClass)
//             .attr('x', d => xScale(d[metricName]) + 5) // Position 5px to the right of the bar end
//             .attr('y', yScale.bandwidth() / 2) // Vertically center in the bar
//             .attr('dy', '0.35em') // Fine-tune vertical alignment
//             .attr('font-size', '10px')
//             .attr('fill', '#333') // Slightly darker text for better readability
//             .text(d => d[metricName].toFixed(1)), 
//         update => update
//             .transition().duration(500)
//             .attr('x', d => xScale(d[metricName]) + 5) // Update position when data changes
//             .text(d => d[metricName].toFixed(1))
//     );
// }

// // Example usage:
// function updateAllCharts(participants, currentTime) {
//     // Create age chart
//     createMetricChart({
//         metricName: 'age',
//         chartId: 'age-chart',
//         axisLabel: 'avg age',
//         participants,
//         currentTime
//     });
    
//     // Create height chart
//     createMetricChart({
//         metricName: 'height',
//         chartId: 'height-chart',
//         axisLabel: 'avg height (in)',
//         participants,
//         currentTime
//     });
    
//     // Create weight chart
//     createMetricChart({
//         metricName: 'weight',
//         chartId: 'weight-chart',
//         axisLabel: 'avg weight (lb)',
//         participants,
//         currentTime
//     });
// }

// function createSimilaritySearchForm(participants) {
//     // Create the form container
//     const formContainer = document.createElement('div');
//     formContainer.className = 'similarity-search';
//     formContainer.style.cssText = `
//         position: fixed;
//         top: 20px;
//         right: 20px;
//         background: white;
//         padding: 20px;
//         border-radius: 8px;
//         box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//         z-index: 1000;
//     `;

//     // Create the form HTML
//     formContainer.innerHTML = `
//         <h3>Find Similar Runner</h3>
//         <form id="similarityForm">
//             <div class="form-group">
//                 <label for="age">Age:</label>
//                 <input type="number" id="age" required min="10" max="65">
//             </div>
//             <div class="form-group">
//                 <label for="weight">Weight (lbs):</label>
//                 <input type="number" id="weight" required min="90" max="300">
//             </div>
//             <div class="form-group">
//                 <label for="height">Height (inches):</label>
//                 <input type="number" id="height" required min="56" max="82">
//             </div>
//             <div class="form-group">
//                 <label for="gender">Gender:</label>
//                 <select id="gender" required>
//                     <option value="F">Female</option>
//                     <option value="M">Male</option>
//                 </select>
//             </div>
//             <button type="submit">Find Similar Runner</button>
//         </form>
//     `;

//     // Add styles
//     const style = document.createElement('style');
//     style.textContent = `
//         .similarity-search .form-group {
//             margin-bottom: 10px;
//         }
//         .similarity-search label {
//             display: block;
//             margin-bottom: 5px;
//         }
//         .similarity-search input,
//         .similarity-search select {
//             width: 100%;
//             padding: 5px;
//             border: 1px solid #ddd;
//             border-radius: 4px;
//         }
//         .similarity-search button {
//             width: 100%;
//             padding: 8px;
//             background: #28ace4;
//             color: white;
//             border: none;
//             border-radius: 4px;
//             cursor: pointer;
//             margin-top: 10px;
//         }
//         .similarity-search button:hover {
//             background: #1e95c9;
//         }
//     `;

//     document.head.appendChild(style);
//     document.body.appendChild(formContainer);

//     // Add form submission handler
//     document.getElementById('similarityForm').addEventListener('submit', (e) => {
//         e.preventDefault();
        
//         const userProfile = {
//             age: +document.getElementById('age').value,
//             weight: +document.getElementById('weight').value,
//             height: +document.getElementById('height').value,
//             gender: document.getElementById('gender').value
//         };

//         const similarParticipant = findSimilarParticipant(userProfile, participants);
        
//         // Store the current scroll position in sessionStorage
//         const timeline = document.getElementById('timeline');
//         sessionStorage.setItem('timelineScroll', timeline.scrollLeft);
//     });
// }

// function findSimilarParticipant(userProfile, participants) {
//     // Normalize the ranges for each metric
//     const maxAge = d3.max(participants, p => p.age);
//     const maxWeight = d3.max(participants, p => p.weight);
//     const maxHeight = d3.max(participants, p => p.height);

//     // Calculate similarity scores
//     const scores = participants.map(participant => {
//         // Only consider participants of the same gender
//         if (participant.gender !== userProfile.gender) {
//             return { participant, score: Infinity };
//         }

//         // Calculate normalized Euclidean distance
//         const ageDiff = Math.abs(participant.age - userProfile.age) / maxAge;
//         const weightDiff = Math.abs(participant.weight - userProfile.weight) / maxWeight;
//         const heightDiff = Math.abs(participant.height - userProfile.height) / maxHeight;

//         // Weighted sum of differences (can adjust weights based on importance)
//         const score = Math.sqrt(
//             Math.pow(ageDiff, 2) +
//             Math.pow(weightDiff, 2) +
//             Math.pow(heightDiff, 2)
//         );

//         return { participant, score };
//     });

//     // Sort by similarity score and return the most similar participant
//     scores.sort((a, b) => a.score - b.score);
//     const similarParticipant = scores[0].participant;

//     // Scroll to the participant's position and highlight it
//     highlightParticipant(similarParticipant.id);
    
//     return similarParticipant;
// }

// function highlightParticipant(participantId) {
//     const timeline = document.getElementById('timeline');
//     const participant = d3.select(`image[data-id="${participantId}"]`);
//     const participantX = +participant.attr('x');

//     // Scroll to the participant's position
//     timeline.scrollLeft = participantX - (timeline.clientWidth / 2);

//     // Add highlight effect
//     participant
//         .style('filter', 'brightness(1.5) drop-shadow(0 0 10px #fff)')
//         .style('transform', 'scale(1.5)')
//         .style('transform-origin', 'center')
//         .style('z-index', 1000);

//     // Remove highlight after 3 seconds
//     setTimeout(() => {
//         participant
//             .style('filter', null)
//             .style('transform', null)
//             .style('z-index', null);
//     }, 3000);
// }


