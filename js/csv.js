export const exportDeckToCSV = (deckName, cards) => {
    const headers = ['Term', 'Part of Speech', 'Definition', 'Example', 'Status'];
    const rows = cards.map(c => [
        `"${(c.term || '').replace(/"/g, '""')}"`,
        `"${(c.partOfSpeech || '').replace(/"/g, '""')}"`,
        `"${(c.definition || '').replace(/"/g, '""')}"`,
        `"${(c.example || '').replace(/"/g, '""')}"`,
        `"${(c.status || 'new').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${deckName.replace(/\s+/g, '_')}_cards.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    const parseLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i+1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };
    
    const cards = [];
    for (let i = 1; i < lines.length; i++) {
        const parsed = parseLine(lines[i]);
        if (parsed.length >= 1) {
            cards.push({
                term: parsed[0] || '',
                partOfSpeech: parsed[1] || '',
                definition: parsed[2] || '',
                example: parsed[3] || '',
                status: parsed[4] || 'new'
            });
        }
    }
    return cards;
};
