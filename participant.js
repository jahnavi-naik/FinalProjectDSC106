// Get participant ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const participantId = urlParams.get('id');

// Load data and initialize visualizations
document.addEventListener('DOMContentLoaded', () => {
    d3.csv('data/data.csv').then(rawData => {
        const participantData = processParticipantData(rawData, participantId);
        const allParticipantsData = processAllParticipantsData(rawData);
        
        displayDemographics(participantData);
        displayConditions(participantData);
        displayPerformance(participantData);
        displayRankings(participantData, allParticipantsData);
        createTimeSeriesCharts(participantData);
    }).catch(error => {
        console.error('Error loading data:', error);
        document.body.innerHTML = 'Error loading data. Please try again.';
    });
});

function processParticipantData(rawData, id) {
    const participantRows = rawData.filter(d => d.ID_x === id);
    if (participantRows.length === 0) return null;

    const firstRow = participantRows[0];
    return {
        id: id,
        age: +firstRow.Age,
        gender: firstRow.Sex === '1' ? 'F' : 'M',
        weight: +firstRow.Weight_lb,
        height: +firstRow.Height_in,
        endurance: d3.max(participantRows, d => +d.Max_Time),
        humidity: +firstRow.Humidity,
        temperature: +firstRow.Temperature,
        maxHR: d3.max(participantRows, d => +d.HR || 0),
        maxSpeed: d3.max(participantRows, d => +d.Speed || 0),
        timeSeriesData: participantRows.map(d => ({
            time: +d.time,
            speed: +d.Speed_mph || 0,
            hr: +d.HR || 0,
            vo2: +d.VO2 || 0,
            vco2: +d.VCO2 || 0,
            rr: +d.RR || 0,
            ve: +d.VE || 0
        })).sort((a, b) => a.time - b.time)
    };
}

function processAllParticipantsData(rawData) {
    const groupedData = d3.group(rawData, d => d.ID_x);
    return Array.from(groupedData).map(([id, data]) => {
        const firstRow = data[0];
        return {
            id: id,
            age: +firstRow.Age,
            gender: firstRow.Sex === '1' ? 'F' : 'M',
            weight: +firstRow.Weight_lb,
            height: +firstRow.Height_in,
            endurance: d3.max(data, d => +d.Max_Time)
        };
    });
}

function displayDemographics(data) {
    const demographics = document.getElementById('demographics');
    demographics.innerHTML = `
        <p><strong>Age:</strong> ${data.age} years</p>
        <p><strong>Gender:</strong> ${data.gender}</p>
        <p><strong>Weight:</strong> ${data.weight.toFixed(1)} lbs</p>
        <p><strong>Height:</strong> ${data.height.toFixed(1)} inches</p>
    `;
}

function displayConditions(data) {
    // Convert temperature from Celsius to Fahrenheit
    const tempInFahrenheit = (data.temperature * 9/5) + 32;
    
    const conditions = document.getElementById('conditions');
    conditions.innerHTML = `
        <p><strong>Temperature:</strong> ${tempInFahrenheit.toFixed(1)}°F</p>
        <p><strong>Humidity:</strong> ${data.humidity.toFixed(1)}%</p>
    `;
}

function displayPerformance(data) {
    const performance = document.getElementById('performance');
    const enduranceMinutes = Math.floor(data.endurance / 60);
    const enduranceSeconds = Math.round(data.endurance % 60);
    
    performance.innerHTML = `
        <p><strong>Total Time:</strong> ${enduranceMinutes}:${enduranceSeconds.toString().padStart(2, '0')}</p>
        <p><strong>Max Speed:</strong> ${data.maxSpeed.toFixed(1)} mph</p>
        <p><strong>Max Heart Rate:</strong> ${data.maxHR} bpm</p>
    `;
}

function displayRankings(data, allData) {
    const rankings = document.getElementById('rankings');
    
    // Calculate percentiles for different categories
    const genderGroup = allData.filter(p => p.gender === data.gender);
    const ageGroup = allData.filter(p => Math.abs(p.age - data.age) <= 5);
    const weightGroup = allData.filter(p => Math.abs(p.weight - data.weight) <= 10);
    const heightGroup = allData.filter(p => Math.abs(p.height - data.height) <= 2);

    const getPercentile = (value, group) => {
        const sortedValues = group.map(p => p.endurance).sort((a, b) => a - b);
        const index = sortedValues.findIndex(v => v >= value);
        // Calculate percentile (0-100 scale)
        const percentRank = ((1 - (index / sortedValues.length)) * 100);
        
        // Return the ordinal percentile (e.g., 0.02th, 99.8th)
        return (100 - percentRank).toFixed(2);
    };

    const totalPercentile = getPercentile(data.endurance, allData);
    const genderPercentile = getPercentile(data.endurance, genderGroup);
    const agePercentile = getPercentile(data.endurance, ageGroup);
    const weightPercentile = getPercentile(data.endurance, weightGroup);
    const heightPercentile = getPercentile(data.endurance, heightGroup);

    rankings.innerHTML = `
        <p><strong>Overall:</strong> ${totalPercentile}th percentile</p>
        <p><strong>Among ${data.gender === 'F' ? 'Females' : 'Males'}:</strong> ${genderPercentile}th percentile</p>
        <p><strong>Age Group:</strong> ${agePercentile}th percentile</p>
        <p><strong>Weight Group:</strong> ${weightPercentile}th percentile</p>
        <p><strong>Height Group:</strong> ${heightPercentile}th percentile</p>
    `;
}

function createTimeSeriesCharts(data) {
    const metrics = [
        { id: 'speed', label: 'Speed (mph)', color: '#28ace4' },
        { id: 'hr', label: 'Heart Rate (bpm)', color: '#ee72c4' },
        { id: 'rr', label: 'Respiratory Rate', color: '#6c90b0' },
        { id: 've', label: 'Ventilation', color: '#76323f' },
        { id: 'vco2', label: 'VCO2', color: '#3e4444' }
    ];

    metrics.forEach(metric => {
        createLineChart(data.timeSeriesData, metric);
    });
}

function createLineChart(timeSeriesData, metric) {
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(`#${metric.id}-chart`)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(timeSeriesData, d => d.time)])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(timeSeriesData, d => d[metric.id])])
        .range([height, 0]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .ticks(5)
            .tickFormat(d => {
                const minutes = Math.floor(d / 60);
                const seconds = Math.round(d % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }));

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add the line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d[metric.id]));

    svg.append('path')
        .datum(timeSeriesData)
        .attr('fill', 'none')
        .attr('stroke', metric.color)
        .attr('stroke-width', 2)
        .attr('d', line);

    // Add labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Time (mm:ss)');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(metric.label);
} 