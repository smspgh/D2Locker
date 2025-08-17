// Data parsing and conversion utilities
window.parseExcelToJSON = function parseExcelToJSON(rawData) {
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split('\t');

    const synergyIdx = headers.indexOf('ArmorSynergy');
    const typeIdx = headers.indexOf('Stat_Type');
    const benefitIdx = headers.indexOf('Stat_Benefit');

    const tierLabels = [];
    for (let i = 3; i < headers.length; i++) {
        tierLabels.push(headers[i].replace('_', ' '));
    }

    const result = {};

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length < 4) {continue;}

        const synergy = parts[synergyIdx];
        const statType = parts[typeIdx];
        const statName = parts[benefitIdx];

        const values = [];
        let isPercentage = false;

        for (let j = 3; j < parts.length && j < headers.length; j++) {
            let value = parts[j];
            if (value.includes('%')) {
                isPercentage = true;
                value = parseFloat(value.replace('%', ''));
            } else {
                value = parseFloat(value) || 0;
            }
            values.push(value);
        }

        const maxValue = Math.max(...values);
        const firstActiveIndex = values.findIndex(v => v > 0);
        const plateauIndex = values.findIndex((v, i) => i > 0 && v === values[i-1] && v === maxValue);

        if (!result[statType]) {
            result[statType] = {};
        }

        result[statType][statName] = {
            synergy: synergy,
            isPercentage: isPercentage,
            values: values,
            tierLabels: tierLabels.slice(0, values.length),
            metadata: {
                maxValue: maxValue,
                firstActiveTier: firstActiveIndex >= 0 ? tierLabels[firstActiveIndex] : null,
                plateauTier: plateauIndex >= 0 ? tierLabels[plateauIndex] : null,
                totalTiers: values.length
            }
        };
    }

    return result;
}
