// Seeds demo decks through the app's own db.js so the recording uses real UI/data.
export const seed = async (page) => {
  await page.evaluate(async () => {
    const db = await import('/js/db.js');
    await db.initDB();
    const bio = await db.addFolder('Biology 101', '#2563eb');
    const std = (term, definition, example = '') => ({ term, definition, example });
    await db.addDeckWithCards('Cell Biology', null, 'flashcards', [
      std('Mitochondria', 'The organelle that produces most of the cell’s ATP.', 'Often called the powerhouse of the cell.'),
      std('Ribosome', 'Molecular machine that builds proteins from amino acids.', 'Found free in the cytoplasm or on the rough ER.'),
      { term: 'The ___ stores genetic information inside eukaryotic cells.', definition: 'nucleus', example: '', type: 'cloze' },
      { term: 'Photosynthesis takes place in the chloroplast.', definition: 'chloroplast', example: '', type: 'cloze' },
      std('Osmosis', 'Diffusion of water across a semipermeable membrane.', 'Water moves toward the higher solute concentration.'),
      std('Golgi apparatus', 'Packages and ships proteins and lipids.', ''),
    ]);
    await db.addDeckWithCards('Spanish Vocabulary', null, 'flashcards', [
      std('Biblioteca', 'Library'), std('Aprender', 'To learn'), std('Siempre', 'Always'), std('Mañana', 'Tomorrow'), std('Ventana', 'Window'),
      std('Escuela', 'School'), std('Amigo', 'Friend'), std('Gracias', 'Thank you'),
    ]);
    await db.addDeckWithCards('Genetics', bio, 'flashcards', [std('Allele', 'A variant form of a gene.'), std('Genotype', 'The genetic makeup of an organism.')]);
    await db.addDeckWithCards('Organic Chemistry', null, 'flashcards', [std('Alkane', 'Hydrocarbon with only single bonds.')]);
    await db.addDeckWithCards('Networks Quiz', null, 'quiz', [
      { type: 'mcq', term: 'Which protocol guarantees ordered, reliable delivery?', choices: ['UDP', 'TCP', 'ICMP', 'ARP'], definition: 'TCP', explanation: 'TCP uses acknowledgements and retransmission.' },
      { type: 'tf', term: 'An IPv4 address is 128 bits long.', definition: 'false', explanation: 'IPv4 is 32 bits; IPv6 is 128 bits.' },
      { type: 'fitb', term: 'DNS translates domain names into ____ addresses.', definition: 'IP', explanation: '' },
      { type: 'mcq', term: 'Which layer does a router operate on?', choices: ['Physical', 'Data link', 'Network', 'Transport'], definition: 'Network', explanation: '' },
    ]);
    // History so the stats bar looks lived-in
    const tx = db.db.transaction(['stats', 'cards'], 'readwrite');
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().split('T')[0];
      tx.objectStore('stats').put({ date: d, know: 18 + (i % 4) * 3, forgot: 3 + (i % 3) });
    }
    const all = tx.objectStore('cards').getAll();
    all.onsuccess = () => all.result.filter((c) => c.type !== 'mcq' && c.type !== 'tf' && c.type !== 'fitb' && c.term !== 'Mitochondria' && c.term !== 'Osmosis').slice(0, 12).forEach((c) => tx.objectStore('cards').put({ ...c, status: 'mastered' }));
    await new Promise((r) => (tx.oncomplete = r));
  });
};
