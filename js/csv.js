export const exportDeckToCSV = (deckName, cards) => {
    const headers = ['Term', 'Definition', 'Type', 'Example', 'Status'];
    const rows = cards.map(c => [
        `"${(c.term || '').replace(/"/g, '""')}"`,
        `"${(c.definition || '').replace(/"/g, '""')}"`,
        `"${(c.type || 'standard').replace(/"/g, '""')}"`,
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
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };
    
    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    
    // Map expected fields to their column index
    const colMap = {
        term: headers.indexOf('term'),
        definition: headers.indexOf('definition'),
        type: headers.indexOf('type'),
        example: headers.indexOf('example'),
        status: headers.indexOf('status')
    };
    
    // Fallback defaults if headers don't strictly match but data exists
    if (colMap.term === -1) colMap.term = 0;
    if (colMap.definition === -1) colMap.definition = 1;
    
    const cards = [];
    for (let i = 1; i < lines.length; i++) {
        const parsed = parseLine(lines[i]);
        if (parsed.length >= 1 && parsed[colMap.term]) {
            cards.push({
                term: parsed[colMap.term] || '',
                definition: colMap.definition !== -1 ? (parsed[colMap.definition] || '') : '',
                type: colMap.type !== -1 ? (parsed[colMap.type] || 'standard').toLowerCase() : 'standard',
                example: colMap.example !== -1 ? (parsed[colMap.example] || '') : '',
                status: colMap.status !== -1 ? (parsed[colMap.status] || 'new') : 'new'
            });
        }
    }
    return cards;
};
