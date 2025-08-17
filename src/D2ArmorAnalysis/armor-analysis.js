// Global variables
let chart;
let jsonData = {};
let currentTab = 'json';

// Sample data for demonstration
const sampleJSON = {
    "Health": {
        "Health Per Orb": {
            "synergy": "Bulwark & Boxer",
            "isPercentage": false,
            "values": [0,7,14,21,28,35,42,49,56,63,70,70,70,70,70,70,70,70,70,70,70],
            "tierLabels": ["Tier Base","Tier 1","Tier 2","Tier 3","Tier 4","Tier 5","Tier 6","Tier 7","Tier 8","Tier 9","Tier 10","Tier 11","Tier 12","Tier 13","Tier 14","Tier 15","Tier 16","Tier 17","Tier 18","Tier 19","Tier 20"],
            "metadata": {"maxValue":70,"firstActiveTier":"Tier 1","plateauTier":"Tier 10","totalTiers":21}
        },
        "Flinch Resistance": {
            "synergy": "Bulwark & Boxer",
            "isPercentage": true,
            "values": [0,1,2,3,4,5,6,7,8,9,10,10,10,10,10,10,10,10,10,10,10],
            "tierLabels": ["Tier Base","Tier 1","Tier 2","Tier 3","Tier 4","Tier 5","Tier 6","Tier 7","Tier 8","Tier 9","Tier 10","Tier 11","Tier 12","Tier 13","Tier 14","Tier 15","Tier 16","Tier 17","Tier 18","Tier 19","Tier 20"],
            "metadata": {"maxValue":10,"firstActiveTier":"Tier 1","plateauTier":"Tier 10","totalTiers":21}
        }
    },
    "Melee": {
        "Melee Cooldown": {
            "synergy": "Boxer & Paragon",
            "isPercentage": true,
            "values": [0,7.4,14.6,21.6,28.4,35,41.4,47.6,53.6,59.4,65,65,65,65,65,65,65,65,65,65,65],
            "tierLabels": ["Tier Base","Tier 1","Tier 2","Tier 3","Tier 4","Tier 5","Tier 6","Tier 7","Tier 8","Tier 9","Tier 10","Tier 11","Tier 12","Tier 13","Tier 14","Tier 15","Tier 16","Tier 17","Tier 18","Tier 19","Tier 20"],
            "metadata": {"maxValue":65,"firstActiveTier":"Tier 1","plateauTier":"Tier 10","totalTiers":21}
        }
    }
};

// Tab switching function
window.switchTab = function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

// File loading functions
function loadJSONFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                jsonData = JSON.parse(e.target.result);
                populateFilter();
                showStatus('fileStatus', `✅ Successfully loaded: ${file.name}`, 'success');
                document.getElementById('controlsSection').style.display = 'flex';

                // Auto-select first stat
                const firstType = Object.keys(jsonData)[0];
                if (firstType) {
                    const firstStat = Object.keys(jsonData[firstType])[0];
                    if (firstStat) {
                        document.getElementById('statFilter').value = firstStat;
                        updateChart();
                    }
                }
            } catch (error) {
                showStatus('fileStatus', '❌ Error: Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
    }
}

function loadJSONFromText() {
    const jsonText = document.getElementById('jsonInput').value;
    try {
        jsonData = JSON.parse(jsonText);
        populateFilter();
        showStatus('fileStatus', '✅ JSON data loaded successfully', 'success');
        document.getElementById('controlsSection').style.display = 'flex';

        // Auto-select first stat
        const firstType = Object.keys(jsonData)[0];
        if (firstType) {
            const firstStat = Object.keys(jsonData[firstType])[0];
            if (firstStat) {
                document.getElementById('statFilter').value = firstStat;
                updateChart();
            }
        }
    } catch (error) {
        showStatus('fileStatus', '❌ Error: Invalid JSON format', 'error');
    }
}

function loadSampleJSON() {
    document.getElementById('jsonInput').value = JSON.stringify(sampleJSON, null, 2);
    loadJSONFromText();
}

function loadExcelData() {
    const excelText = document.getElementById('excelInput').value;
    if (excelText.trim()) {
        jsonData = parseExcelToJSON(excelText);
        populateFilter();
        showStatus('fileStatus', '✅ Excel data converted and loaded', 'success');
        document.getElementById('controlsSection').style.display = 'flex';

        // Auto-select first stat
        const firstType = Object.keys(jsonData)[0];
        if (firstType) {
            const firstStat = Object.keys(jsonData[firstType])[0];
            if (firstStat) {
                document.getElementById('statFilter').value = firstStat;
                updateChart();
            }
        }
    }
}

// Utility functions
function showStatus(elementId, message, type) {
    const status = document.getElementById(elementId);
    status.textContent = message;
    status.className = `file-status ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}

function populateFilter() {
    const select = document.getElementById('statFilter');
    select.innerHTML = '<option value="">-- Select a stat --</option>';

    for (const type in jsonData) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = type;

        for (const statName in jsonData[type]) {
            const option = document.createElement('option');
            option.value = statName;
            option.textContent = statName;
            option.dataset.type = type;
            optgroup.appendChild(option);
        }

        select.appendChild(optgroup);
    }
}

window.calculateDifferences = function calculateDifferences(values) {
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
        diffs.push({
            index: i,
            diff: values[i] - values[i-1]
        });
    }
    return diffs;
}

window.updateChart = function updateChart() {
    const selectedStat = document.getElementById('statFilter').value;
    const selectedOption = document.getElementById('statFilter').selectedOptions[0];

    if (!selectedStat || !selectedOption) {return;}

    const type = selectedOption.dataset.type;
    const data = jsonData[type][selectedStat];

    if (!data) {return;}

    createChart(data, selectedStat);
}

// Auto-load data.json on page load
async function loadDataJSON() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        jsonData = await response.json();
        populateFilter();
        showStatus('loadStatus', '✅ Data loaded successfully from data.json', 'success');
        document.getElementById('controlsSection').style.display = 'flex';

        // Auto-select first stat
        const firstType = Object.keys(jsonData)[0];
        if (firstType) {
            const firstStat = Object.keys(jsonData[firstType])[0];
            if (firstStat) {
                document.getElementById('statFilter').value = firstStat;
                updateChart();
            }
        }

        console.log('JSON data loaded successfully:', Object.keys(jsonData).length, 'stat types found');
    } catch (error) {
        console.error('Error loading data.json:', error);
        showStatus('loadStatus', '❌ Error loading data.json - using sample data', 'error');

        // Fallback to sample data
        jsonData = sampleJSON;
        populateFilter();
        document.getElementById('controlsSection').style.display = 'flex';

        const firstType = Object.keys(jsonData)[0];
        if (firstType) {
            const firstStat = Object.keys(jsonData[firstType])[0];
            if (firstStat) {
                document.getElementById('statFilter').value = firstStat;
                updateChart();
            }
        }
    }
}

// Initialize with automatic data.json loading
window.addEventListener('load', () => {
    loadDataJSON();
});
