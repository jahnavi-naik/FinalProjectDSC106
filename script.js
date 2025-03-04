let ageChart;
let rawData;
let maxTime;

function initializeChart() {
    const ctx = document.getElementById('ageChart').getContext('2d');
    ageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Still Running', 'Stopped Running'],
            datasets: [{
                label: 'Average Age',
                data: [0, 0],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Age (years)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Average Age Comparison'
                }
            }
        }
    });
}

function updateVisualization(currentMinutes) {
    const currentSeconds = currentMinutes * 60;
    
    // Filter data for the current time
    const stillRunning = rawData.filter(d => d.time >= currentSeconds);
    const stoppedRunning = rawData.filter(d => d.time < currentSeconds);

    // Calculate averages
    const avgAgeRunning = stillRunning.length > 0 
        ? d3.mean(stillRunning, d => d.Age)
        : 0;
    
    const avgAgeStopped = stoppedRunning.length > 0 
        ? d3.mean(stoppedRunning, d => d.Age)
        : 0;

    // Update chart
    ageChart.data.datasets[0].data = [avgAgeRunning, avgAgeStopped];
    ageChart.update();
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load and process the CSV data
    d3.csv('data/data.csv', function(d) {
        return {
            Age: +d.Age,  // Convert to number
            time: +d.time,  // Convert to number
            // Add other columns as needed
        };
    }).then(function(data) {
        rawData = data;
        
        // Find maximum time in seconds
        maxTime = d3.max(data, d => d.time);
        const maxMinutes = Math.ceil(maxTime / 60);
        
        // Update slider max value
        const timeSlider = document.getElementById('timeSlider');
        timeSlider.max = maxMinutes;
        
        // Initialize chart
        initializeChart();
        updateVisualization(0);
        
        // Set up slider event listener
        timeSlider.addEventListener('input', function(e) {
            const currentMinutes = parseInt(e.target.value);
            document.getElementById('currentTime').textContent = 
                `Time: ${currentMinutes} minutes`;
            updateVisualization(currentMinutes);
        });
    }).catch(function(error) {
        console.error('Error loading the CSV file:', error);
    });
});
