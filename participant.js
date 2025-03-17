// Get participant ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const participantId = urlParams.get('id');

window.onload = function () {
    if (participantId) {
        document.getElementById('runner-id').textContent = participantId;
    } else {
        console.warn('Participant ID not found in URL.');
    }
};

// Load data and initialize visualizations
document.addEventListener('DOMContentLoaded', () => {
    d3.csv('data/data.csv').then(rawData => {
        const participantData = processParticipantData(rawData, participantId);
        const allParticipantsData = processAllParticipantsData(rawData);
        
        displayDemographics(participantData);
        displayConditions(participantData, allParticipantsData);
        displayPerformance(participantData);
        displayRankings(participantData, allParticipantsData);
        createTimeSeriesCharts(participantData);
    }).catch(error => {
        console.error('Error loading data:', error);
        document.body.innerHTML = 'Error loading data. Please try again.';
    });
});

// Age Group Classification
function getAgeGroup(age) {
    if (age >= 10 && age <= 19) return '10-19';
    if (age >= 20 && age <= 29) return '20-29';
    if (age >= 30 && age <= 39) return '30-39';
    if (age >= 40 && age <= 49) return '40-49';
    if (age >= 50 && age <= 65) return '50-65';
    return 'Unknown';
}

// Weight Group Classification
function getWeightGroup(weight) {
    if (weight >= 90 && weight <= 119) return '90-119 lbs';
    if (weight >= 120 && weight <= 149) return '120-149 lbs';
    if (weight >= 150 && weight <= 189) return '150-189 lbs';
    if (weight >= 190 && weight <= 219) return '190-219 lbs';
    if (weight >= 220 && weight <= 249) return '220-249 lbs';
    if (weight >= 250 && weight <= 300) return '250-300 lbs';
    return 'Unknown';
}

// Height Group Classification
function getHeightGroup(height) {
    if (height >= 58 && height <= 64) return '58-64 in';
    if (height >= 65 && height <= 69) return '65-69 in';
    if (height >= 70 && height <= 74) return '70-74 in';
    if (height >= 75 && height <= 80) return '75-80 in';
    return 'Unknown';
}


function processParticipantData(rawData, id) {
    const participantRows = rawData.filter(d => d.ID_x === id);
    if (participantRows.length === 0) return null;

    const firstRow = participantRows[0];
    const weightKg = +firstRow.Weight;
    const age = +firstRow.Age;
    const weightlb = +firstRow.Weight_lb;
    const heightin = +firstRow.Height_in;
    const maxSpeed = d3.max(participantRows, d => +d.Speed_mph || 0);
    const endurance = d3.max(participantRows.filter(d => +d.Speed_mph === maxSpeed), d => +d.time);

    return {
        id: id,
        age: age,
        gender: firstRow.Sex === '1' ? 'F' : 'M',
        weight: weightlb,
        height: heightin,
        age_group: getAgeGroup(age),
        weight_group: getWeightGroup(weightlb),
        height_group: getHeightGroup(heightin),
        endurance: endurance,
        humidity: +firstRow.Humidity,
        temperature: +firstRow.Temperature,
        maxHR: d3.max(participantRows, d => +d.HR || 0),
        maxSpeed: maxSpeed,
        maxVE: d3.max(participantRows, d => +d.VE || 0),
        maxVO2: d3.max(participantRows, d => (+d.VO2 || 0) / weightKg),
        timeSeriesData: participantRows.map(d => ({
            time: +d.time,
            speed: +d.Speed_mph || 0,
            hr: +d.HR || 0,
            vo2: (+d.VO2 || 0) / weightKg, 
            vco2: (+d.VCO2 || 0) / weightKg, 
            ve: +d.VE || 0
        })).sort((a, b) => a.time - b.time)
    };
}


function processAllParticipantsData(rawData) {
    const groupedData = d3.group(rawData, d => d.ID_x);
    return Array.from(groupedData).map(([id, data]) => {
        const firstRow = data[0];
        const age = +firstRow.Age;
        const weightlb = +firstRow.Weight_lb;
        const heightin = +firstRow.Height_in;
        const maxSpeed = d3.max(data, d => +d.Speed_mph || 0);
        const endurance = d3.max(data.filter(d => +d.Speed_mph === maxSpeed), d => +d.time);

        return {
            id: id,
            age: age,
            gender: firstRow.Sex === '1' ? 'F' : 'M',
            weight: +firstRow.Weight_lb,
            height: +firstRow.Height_in,
            age_group: getAgeGroup(age),
            weight_group: getWeightGroup(weightlb),
            height_group: getHeightGroup(heightin),
            endurance: endurance,
            temperature: +firstRow.Temperature,
            humidity: +firstRow.Humidity
        };
    });
}


function displayDemographics(data) {

    // Display demographic data
    const genderGroup = document.getElementById('gender-group');
    const ageGroup = document.getElementById('age-group');
    const weightGroup = document.getElementById('weight-group');
    const heightGroup = document.getElementById('height-group');

    genderGroup.textContent = `${data.gender}`;
    ageGroup.textContent = `${data.age} years`;
    weightGroup.textContent = `${data.weight.toFixed(1)} lbs`;
    heightGroup.textContent = `${data.height.toFixed(1)} in`;

    // Hover effect for swapping text
    ageGroup.addEventListener('mouseenter', () => ageGroup.textContent = `${data.age_group} years`);
    ageGroup.addEventListener('mouseleave', () => ageGroup.textContent = `${data.age} years`);

    weightGroup.addEventListener('mouseenter', () => weightGroup.textContent = `${data.weight_group}`);
    weightGroup.addEventListener('mouseleave', () => weightGroup.textContent = `${data.weight.toFixed(1)} lbs`);

    heightGroup.addEventListener('mouseenter', () => heightGroup.textContent = `${data.height_group}`);
    heightGroup.addEventListener('mouseleave', () => heightGroup.textContent = `${data.height.toFixed(1)} in`);

}


function displayConditions(data, allParticipants) {
    if (!data) {
        console.error("Error: Participant data is missing.");
        return;
    }

    // Convert participant's temperature to Fahrenheit
    const tempInFahrenheit = data.temperature 
        ? (data.temperature * 9/5) + 32 
        : null;

    // Calculate min/max for temperature and humidity
    const minTemp = d3.min(allParticipants, d => (+d.temperature * 9/5) + 32);
    const maxTemp = d3.max(allParticipants, d => (+d.temperature * 9/5) + 32);
    console.log(minTemp, maxTemp);

    const minHumidity = d3.min(allParticipants, d => +d.humidity);
    const maxHumidity = d3.max(allParticipants, d => +d.humidity);
    console.log(minHumidity, maxHumidity);

    // Calculate position on gradient bar
    const tempPosition = tempInFahrenheit
        ? ((tempInFahrenheit - minTemp) / (maxTemp - minTemp)) * 100
        : 0;

    const humidityPosition = data.humidity
        ? ((data.humidity - minHumidity) / (maxHumidity - minHumidity)) * 100
        : 0;

    // Display conditions with gradient bars
    const conditions = document.getElementById('conditions');
    conditions.innerHTML = `
    <div class="condition-item">
        <p><strong>Temperature:</strong> ${tempInFahrenheit !== null ? tempInFahrenheit.toFixed(1) + "°F" : "N/A"}</p>
        <div class="gradient-bar">
            <div class="gradient-track" style="background: linear-gradient(to right, #3b82f6, #ef4444);">
                <div class="marker" style="left: ${tempPosition}%"></div>
            </div>
            <div class="range-labels">
                <span class="label-left">${minTemp.toFixed(1)}°F</span>
                <span class="label-right">${maxTemp.toFixed(1)}°F</span>
            </div>
        </div>
    </div>

    <div class="condition-item">
        <p><strong>Humidity:</strong> ${data.humidity.toFixed(1)}%</p>
        <div class="gradient-bar">
            <div class="gradient-track" style="background: linear-gradient(to right, #ffde36, #29ace4                );">
                <div class="marker" style="left: ${humidityPosition}%"></div>
            </div>
            <div class="range-labels">
                <span class="label-left">${minHumidity.toFixed(1)}%</span>
                <span class="label-right">${maxHumidity.toFixed(1)}%</span>
            </div>
        </div>
    </div>
    `;
}


function displayPerformance(data) {
    const performance = document.getElementById('performance');

    // Calculate endurance in minutes and seconds
    const enduranceMinutes = Math.floor(data.endurance / 60);
    const enduranceSeconds = Math.round(data.endurance % 60);

    // Clear previous performance content
    performance.innerHTML = '';

    // Create a new dl, dt, dd structure for performance stats
    const performance_dl = d3.select('#performance').append('dl');

    performance_dl.append('dt').text('Endurance Time');
    performance_dl.append('dd').text(`${enduranceMinutes}:${enduranceSeconds.toString().padStart(2, '0')}`);

    performance_dl.append('dt').text('Max Speed');
    performance_dl.append('dd').html(`${data.maxSpeed.toFixed(1)} <span class="unit">mph</span>`);

    performance_dl.append('dt').text('Max Heart Rate');
    performance_dl.append('dd').html(`${data.maxHR} <span class="unit">bpm</span>`);

    performance_dl.append('dt').text('Max Ventilation');
    performance_dl.append('dd').html(`${data.maxVE} <span class="unit">L/min</span>`);
    
    performance_dl.append('dt').text('Max VO2');
    performance_dl.append('dd').html(`${data.maxVO2.toFixed(1)} <span class="unit">mL/kg/min</span>`);
    
}

function displayRankings(data, allData) {
    const rankings = document.getElementById('rankings');
    
    // Ensure that the groups are properly classified based on the `data`
    const genderGroup = allData.filter(p => p.gender === data.gender);
    const ageGroup = allData.filter(p => p.age_group === data.age_group);
    const weightGroup = allData.filter(p => p.weight_group === data.weight_group);
    const heightGroup = allData.filter(p => p.height_group === data.height_group);

    console.log(genderGroup, ageGroup, weightGroup, heightGroup);

    // Function to calculate the percentile rank
    const getPercentile = (value, group) => {
        if (group.length === 0) return "N/A"; // Handle empty group
        
        const enduranceValues = group.map(p => p.endurance);
        // Count values less than the input value
        const countLessThan = enduranceValues.filter(v => v < value).length;
        // Count values equal to the input value
        const countEqual = enduranceValues.filter(v => v === value).length;
        
        // Calculate percentile (0-100 scale)
        // This formula includes half of the tied values in the percentile calculation
        const percentRank = ((countLessThan + (countEqual / 2)) / group.length) * 100;
        
        return percentRank.toFixed(1); 
    };

    // Calculate the percentiles for each group
    const totalPercentile = getPercentile(data.endurance, allData);
    const genderPercentile = getPercentile(data.endurance, genderGroup);
    const agePercentile = getPercentile(data.endurance, ageGroup);
    const weightPercentile = getPercentile(data.endurance, weightGroup);
    const heightPercentile = getPercentile(data.endurance, heightGroup);

    // Clear previous rankings content
    d3.select('#rankings').html('');

    // Create a new dl, dt, dd structure for rankings
    const rankings_dl = d3.select('#rankings').append('dl');

    rankings_dl.append('dt').text('Overall');
    rankings_dl.append('dd').html(`${totalPercentile}<span class='th'>th</span>`);

    rankings_dl.append('dt').text(`Among ${data.gender === 'F' ? 'Females' : 'Males'}`);
    rankings_dl.append('dd').html(`${genderPercentile}<span class='th'>th</span>`);

    rankings_dl.append('dt').text('Age Group');
    rankings_dl.append('dd').html(`${agePercentile}<span class='th'>th</span>`);

    rankings_dl.append('dt').text('Weight Group');
    rankings_dl.append('dd').html(`${weightPercentile}<span class='th'>th</span>`);

    rankings_dl.append('dt').text('Height Group');
    rankings_dl.append('dd').html(`${heightPercentile}<span class='th'>th</span>`);
}


function createTimeSeriesCharts(data) {
    // Keep track of all cleanup functions
    const cleanupFunctions = [];
    
    // Create speed chart separately
    const speedCleanup = createLineChart(data.timeSeriesData, { 
        id: 'speed', 
        name: 'Speed (mph)', 
        color: '#28ace4' 
    }, true);
    cleanupFunctions.push(speedCleanup);

    // Create other charts
    const metrics = [
        { id: 'hr', name: 'heart rate (bpm)', color: '#ee72c4' },
        { id: 'vo2', name: 'vo2 (mL/kg/min)', color: '#6c90b0' },
        { id: 've', name: 'ventilation (L/min)', color: '#76323f' },
        { id: 'vco2', name: 'vco2 (mL/kg/min)', color: '#3e4444' }
    ];

    metrics.forEach(metric => {
        const cleanup = createLineChart(data.timeSeriesData, metric, false, data.endurance);
        cleanupFunctions.push(cleanup);
    });

    // Return a master cleanup function
    return function cleanupAllCharts() {
        cleanupFunctions.forEach(cleanup => cleanup());
    };
}

// Add this function to handle global window resize events
function setupGlobalResizeHandler() {
    // Throttle function to limit how often the resize handler fires
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Find all chart containers and trigger their update functions
    const updateAllCharts = throttle(() => {
        d3.selectAll('[id$="-chart"]').each(function() {
            const chartData = d3.select(this).node().__chart__;
            if (chartData && chartData.updateChart) {
                chartData.updateChart();
            }
        });
    }, 100); // 100ms throttle

    // Add global resize listener
    window.addEventListener('resize', updateAllCharts);

    // Return cleanup function
    return function cleanupGlobalHandler() {
        window.removeEventListener('resize', updateAllCharts);
    };
}

// Example usage:
function initializeCharts(data) {
    const chartsCleanup = createTimeSeriesCharts(data);
    const resizeCleanup = setupGlobalResizeHandler();
    
    // Return a combined cleanup function
    return function cleanupAll() {
        chartsCleanup();
        resizeCleanup();
    };
}

function createLineChart(timeSeriesData, metric, isSpeedChart, enduranceTime) {
    const container = d3.select(`#${metric.id}-chart`);
    container.html(''); // Clear existing content

    const margin = isSpeedChart 
        ? { top: 10, right: 30, bottom: 30, left: 60 }
        : { top: 20, right: 30, bottom: 30, left: 60 };

    // Set initial dimensions
    let width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    let height = isSpeedChart ? 50 : Math.min(300, width * 0.6) - margin.top - margin.bottom;
    
    // Create SVG with a viewBox for better responsiveness
    const svg = container.append('svg')
        .attr('width', '100%') // Set to 100% to ensure it shrinks with container
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMinYMin meet')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(timeSeriesData, d => d.time)])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(timeSeriesData, d => d[metric.id]) * 1.05]) // Add 5% padding
        .range([height, 0]);

    // Add X axis
    const xAxis = svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .ticks(Math.max(3, width / 100)) // Dynamic number of ticks
            .tickFormat(d => {
                const minutes = Math.floor(d / 60);
                const seconds = Math.round(d % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }));

    // Add Y axis
    const yAxis = svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y)
            .ticks(Math.max(3, height / 50)));

    // Add the participant's line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d[metric.id]));

    const path = svg.append('path')
        .datum(timeSeriesData)
        .attr('class', 'participant-line')
        .attr('fill', 'none')
        .attr('stroke', metric.color)
        .attr('stroke-width', 2)
        .attr('d', line);

    // Add metric label
    if (!isSpeedChart) {
        svg.append('text')
            .attr('class', 'metric-label')
            .attr('x', -height / 2)
            .attr('y', -margin.left + 15)
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.8em')
            .text(metric.name || metric.id);
    } else {
        svg.append('text')
            .attr('class', 'metric-label')
            .attr('x', (-height - 10) / 2)
            .attr('y', -margin.left + 20)
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'middle')
            .style('font-size', '0.7em')
            .text('speed (mph)');
    }

    // Add time label (only if enough space)
    if (width > 200) {
        svg.append('text')
            .attr('class', 'time-label')
            .attr('x', width / 2)
            .attr('y', height + 30)
            .attr('text-anchor', 'middle')
            .style('font-size', '0.8em')
            .text('time (min:sec)');
    }

    if (enduranceTime) {
        svg.append('line')
            .attr('class', 'endurance-line')
            .attr('x1', x(enduranceTime))
            .attr('x2', x(enduranceTime))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'red')
            .attr('stroke-dasharray', '6 3') // Dashed line for visibility
            .attr('stroke-width', 2);
    
        // Add label for the endurance time
        svg.append('text')
            .attr('class', 'endurance-label')
            .attr('x', x(enduranceTime))
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('fill', 'red')
            .style('font-size', '0.8em')
            .text(`max endurance`);
    }
    

    // Function to update the chart when window resizes
    function updateChartDimensions() {
        // Get new container width
        const newWidth = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const newHeight = isSpeedChart ? 50 : Math.min(300, newWidth * 0.6) - margin.top - margin.bottom;
        
        // Only update if dimensions have actually changed
        if (newWidth !== width || newHeight !== height) {
            width = newWidth;
            height = newHeight;
            
            // Update svg dimensions and viewBox
            container.select('svg')
                .attr('height', height + margin.top + margin.bottom)
                .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
                
            // Update scales
            x.range([0, width]);
            y.range([height, 0]);
            
            // Update X axis
            xAxis.attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(x)
                    .ticks(Math.max(3, width / 100))
                    .tickFormat(d => {
                        const minutes = Math.floor(d / 60);
                        const seconds = Math.round(d % 60);
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }));
            
            // Update Y axis
            yAxis.call(d3.axisLeft(y).ticks(Math.max(3, height / 50)));
            
            // Update line
            path.attr('d', line);
            
            // Update labels position
            container.select('.metric-label')
                .attr('x', -height / 2);
                
            container.select('.time-label')
                .attr('x', width / 2)
                .attr('y', height + 30);

            // Update endurance line
            if (enduranceTime) {
                container.select('.endurance-line')
                    .attr('x1', x(enduranceTime))
                    .attr('x2', x(enduranceTime))
                    .attr('y1', 0)
                    .attr('y2', height);

                
                container.select('.endurance-label')
                    .attr('x', x(enduranceTime))
                    .attr('y', -5);
            }
        }
    }

    // Store the update function and dimensions
    container.node().__chart__ = {
        x, y, line, svg, metric,
        width, height, margin,
        updateChart: updateChartDimensions
    };

    // Set up window resize listener
    const resizeListener = () => updateChartDimensions();
    window.addEventListener('resize', resizeListener);

    // Return cleanup function
    return function cleanup() {
        window.removeEventListener('resize', resizeListener);
    };
}

function returnToTimeline() {
    const urlParams = new URLSearchParams(window.location.search);
    const participantId = urlParams.get('id');

    if (participantId) {
        sessionStorage.setItem('lastViewedParticipant', participantId);
    } else {
        console.warn('Participant ID not found in URL.');
    }

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 100); // Small delay to ensure session data is saved
}


