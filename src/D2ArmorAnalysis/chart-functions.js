// Chart creation and management functions
window.createChart = function createChart(data, statName) {
    const ctx = document.getElementById('tierChart').getContext('2d');

    const differences = calculateDifferences(data.values);
    const maxDiff = Math.max(...differences.map(d => d.diff));
    const maxDiffIndex = differences.find(d => d.diff === maxDiff).index;

    const pointRadius = data.values.map((_, index) => index === maxDiffIndex ? 8 : 4);
    const pointBackgroundColor = data.values.map((_, index) =>
        index === maxDiffIndex ? '#ff6b6b' : '#667eea'
    );

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.tierLabels,
            datasets: [{
                label: statName,
                data: data.values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: pointRadius,
                pointBackgroundColor: pointBackgroundColor,
                pointBorderColor: pointBackgroundColor,
                pointHoverRadius: 10,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }

                            if (data.isPercentage) {
                                label += `${context.parsed.y.toFixed(2)  }%`;
                            } else {
                                label += context.parsed.y.toFixed(0);
                            }

                            if (context.dataIndex > 0) {
                                const diff = context.parsed.y - context.dataset.data[context.dataIndex - 1];
                                if (data.isPercentage) {
                                    label += ` (+${  diff.toFixed(2)  }%)`;
                                } else {
                                    label += ` (+${  diff.toFixed(0)  })`;
                                }
                            }

                            if (context.dataIndex === maxDiffIndex) {
                                label += ' 🔥 MAX INCREASE';
                            }

                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: data.isPercentage ? 'Benefit (%)' : 'Value',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            if (data.isPercentage) {
                                return `${value.toFixed(1)  }%`;
                            } else {
                                return value.toFixed(0);
                            }
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tier',
                        font: {
                            size: 14
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Update current stat display
    document.getElementById('currentStat').style.display = 'flex';
    document.getElementById('currentStatName').textContent = statName;
    document.getElementById('synergyBadge').innerHTML = `<span class="synergy-badge">${data.synergy}</span>`;

    // Update stats
    updateStats(data, differences, maxDiffIndex, maxDiff);
}

window.updateStats = function updateStats(data, differences, maxDiffIndex, maxDiff) {
    const statsContainer = document.getElementById('statsContainer');

    const totalIncrease = data.values[data.values.length - 1] - data.values[0];
    const avgIncrease = differences.reduce((sum, d) => sum + d.diff, 0) / differences.length;

    const formatValue = (val) => {
        if (data.isPercentage) {
            return `${val.toFixed(2)  }%`;
        } else {
            return val.toFixed(0);
        }
    };

    let statsHTML = `
        <div class="stat-card">
            <div class="stat-label">Max Benefit Change Tier</div>
            <div class="stat-value">${data.tierLabels[maxDiffIndex]}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Max Benefit Change Tier Value</div>
            <div class="stat-value">+${formatValue(maxDiff)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Maximum Benefit Increase Possible</div>
            <div class="stat-value">${formatValue(totalIncrease)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Average per Tier</div>
            <div class="stat-value">+${formatValue(avgIncrease)}</div>
        </div>
    `;

    if (data.metadata.firstActiveTier && data.metadata.firstActiveTier !== 'Tier Base') {
        statsHTML += `
            <div class="stat-card">
                <div class="stat-label">First Active Tier</div>
                <div class="stat-value">${data.metadata.firstActiveTier}</div>
            </div>
        `;
    }

    if (data.metadata.plateauTier) {
        statsHTML += `
            <div class="stat-card">
                <div class="stat-label">Max Value Reached</div>
                <div class="stat-value">${data.metadata.plateauTier}</div>
            </div>
        `;
    }

    statsContainer.innerHTML = statsHTML;
}
