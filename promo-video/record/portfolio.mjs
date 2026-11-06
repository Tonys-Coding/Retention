// Renders five portfolio screenshots (2656x1660) of the real app with realistic demo data.
// Usage (repo root): python3 -m http.server 8765 &   then   node promo-video/record/portfolio.mjs
import {chromium} from 'playwright-core';
import {execSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const OUT = 'portfolio-screenshots';
const ONLY = process.env.ONLY; // e.g. ONLY=5 to re-render one shot
mkdirSync(OUT, {recursive: true});
const W = 1660, H = 1038, DPR = 1.6;   // 1660 x 1.6 = 2656 px wide; 1038 x 1.6 = 1660.8 px tall (cropped to 1660)
const URL = 'http://localhost:8765/dashboard.html';

const seedData = async (page) => {
  await page.evaluate(async () => {
    const db = await import('/js/db.js');
    await db.initDB();
    const C = (term, definition, example = '') => ({ term, definition, example });
    const F = (term, answer) => ({ term, definition: answer, example: '', type: 'cloze' });
    const mcq = (term, choices, answer, explanation = '') => ({ type: 'mcq', term, choices, definition: answer, explanation });
    const tf = (term, v, explanation = '') => ({ type: 'tf', term, definition: v ? 'true' : 'false', explanation });
    const fitb = (term, answer, explanation = '') => ({ type: 'fitb', term, definition: answer, explanation });

    const decks = {};
    const mk = async (key, name, folderId, cards, kind = 'flashcards', mastered = .4, learning = .2) => {
      const withStatus = cards.map((c, i) => kind === 'quiz' ? c : ({ ...c, status: i < cards.length * mastered ? 'mastered' : i < cards.length * (mastered + learning) ? 'learning' : 'new' }));
      decks[key] = await db.addDeckWithCards(name, folderId, kind, withStatus);
    };

    const net = await db.addFolder('Computer Networks', '#2563eb');
    const bio = await db.addFolder('Biology 101', '#16a34a');
    const spa = await db.addFolder('Spanish', '#f59e0b');
    const prep = await db.addFolder('Exam Prep', '#e11d48', net);

    await mk('http', 'Application Layer & HTTP', net, [
      C('HTTP', 'Stateless request–response protocol of the web', 'GET /index.html HTTP/1.1'), C('HTTP 404', 'Status code: the requested resource was not found'),
      C('HTTP 301', 'Moved permanently; the new URL is in the Location header'), C('Persistent connection', 'Keeps one TCP connection open for several requests (default in HTTP/1.1)'),
      C('Cookie', 'Small state token the server sets and the browser sends back to keep a session'), C('DNS', 'Distributed system that maps hostnames to IP addresses'),
      C('CDN', 'Network of edge servers that caches content close to users'), C('HTTP/2 multiplexing', 'Many streams share one connection, avoiding HTTP-level head-of-line blocking'),
      C('Conditional GET', 'Uses If-Modified-Since so the server can answer 304 Not Modified'), C('SMTP', 'Push protocol used to send email between mail servers')], 'flashcards', .6, .2);
    await mk('tcp', 'Transport: TCP vs UDP', net, [
      C('TCP', 'Reliable, ordered, connection-oriented byte stream'), C('UDP', 'Connectionless, unreliable datagram service with no handshake'),
      C('Three-way handshake', 'SYN, SYN-ACK, ACK establishes a TCP connection'), C('Flow control', 'The receiver’s advertised window stops the sender from overwhelming it'),
      C('Sequence number', 'Byte offset that identifies the data in a TCP segment'), C('Cumulative ACK', 'Acknowledges the next byte the receiver expects'),
      C('Checksum', '16-bit ones-complement sum used to detect corrupted segments'), C('Port number', '16-bit identifier that demultiplexes segments to a socket'),
      C('RTT', 'Round-trip time; drives the retransmission timeout'), C('Fast retransmit', 'Resend after 3 duplicate ACKs instead of waiting for a timeout'),
      F('TCP uses a ___-way handshake to open a connection.', 'three')], 'flashcards', .7, .15);
    await mk('cc', 'TCP Congestion Control', net, [
      C('Slow start', 'cwnd doubles every RTT until it reaches ssthresh'), C('Congestion avoidance', 'cwnd grows by one MSS per RTT (additive increase)'),
      C('AIMD', 'Additive increase, multiplicative decrease: the basis of TCP fairness'), C('ssthresh', 'Threshold at which slow start hands over to congestion avoidance'),
      C('TCP Reno', 'Triple duplicate ACK halves cwnd; a timeout resets it to 1 MSS'), C('cwnd', 'Congestion window: limits how many bytes may be in flight'),
      C('TCP CUBIC', 'Window growth is a cubic function of time since the last loss'), C('ECN', 'Routers mark packets instead of dropping them to signal congestion')], 'flashcards', .25, .45);
    await mk('ip', 'Network Layer & IP', net, [
      C('IPv4 address', '32-bit address written as four octets'), C('CIDR', 'Classless addressing with a prefix length such as /24'),
      C('NAT', 'Rewrites private addresses to a public one at the network edge'), C('Longest prefix match', 'A router forwards using the most specific matching entry'),
      C('ICMP', 'Carries errors and diagnostics; used by ping and traceroute'), C('Dijkstra', 'Link-state shortest-path algorithm'),
      C('Bellman–Ford', 'Distance-vector algorithm used by RIP'), C('BGP', 'Path-vector protocol that routes between autonomous systems'),
      C('TTL', 'Hop limit that stops packets looping forever'), C('DHCP', 'Hands out IP configuration to hosts automatically')], 'flashcards', .5, .3);
    await mk('formulas', 'Key Formulas', prep, [
      C('Transmission delay', 'L / R (packet length over link rate)'), C('Propagation delay', 'd / s (distance over propagation speed)'),
      C('Total nodal delay', 'd_proc + d_queue + d_trans + d_prop'), C('Stop-and-wait utilization', '(L/R) / (RTT + L/R)'), C('Subnet size', '2^(32 − prefix) addresses')], 'flashcards', .4, .4);

    await mk('quizNet', 'Networks Midterm Practice', prep, [
      mcq('Which protocol guarantees ordered, reliable delivery?', ['UDP', 'TCP', 'ICMP', 'ARP'], 'TCP', 'TCP uses sequence numbers, acknowledgements and retransmission.'),
      tf('An IPv4 address is 128 bits long.', false, 'IPv4 is 32 bits; IPv6 is 128 bits.'),
      fitb('DNS translates domain names into ____ addresses.', 'IP'),
      mcq('Which layer does a router operate on?', ['Physical', 'Data link', 'Network', 'Transport'], 'Network'),
      mcq('What does slow start do to cwnd each RTT?', ['Adds 1 MSS', 'Doubles it', 'Halves it', 'Resets it to 1'], 'Doubles it', 'Until it reaches ssthresh; then congestion avoidance takes over.'),
      tf('UDP performs a three-way handshake.', false),
      fitb('A router picks the route with the longest ____ match.', 'prefix'),
      mcq('HTTP 301 means…', ['Not found', 'Moved permanently', 'Server error', 'Not modified'], 'Moved permanently'),
      tf('A CDN caches content on edge servers close to users.', true),
      mcq('Which algorithm is link-state?', ['Bellman–Ford', 'Dijkstra', 'RIP', 'BGP'], 'Dijkstra'),
      fitb('Three duplicate ACKs trigger fast ____.', 'retransmit'),
      mcq('Which header field stops routing loops?', ['TTL', 'Checksum', 'Port', 'Flags'], 'TTL')], 'quiz');

    await mk('cell', 'Cell Biology', bio, [
      C('Mitochondria', 'Organelle that produces most of the cell’s ATP', 'Often called the powerhouse of the cell'), C('Ribosome', 'Molecular machine that builds proteins from amino acids', 'Free in the cytoplasm or on the rough ER'),
      C('Nucleus', 'Stores the cell’s DNA and controls gene expression'), C('Osmosis', 'Diffusion of water across a semipermeable membrane', 'Water moves toward the higher solute concentration'),
      C('Golgi apparatus', 'Modifies, packages and ships proteins and lipids'), C('Lysosome', 'Digests waste and worn-out organelles with enzymes'),
      C('Endoplasmic reticulum', 'Network of membranes: rough ER makes proteins, smooth ER makes lipids'), C('Cytoskeleton', 'Protein fibres that give the cell shape and move organelles'),
      F('The ___ is the site of photosynthesis in plant cells.', 'chloroplast'), F('Proteins are packaged for secretion by the ___ apparatus.', 'Golgi'),
      F('The ___ membrane is selectively permeable.', 'plasma'), C('Vacuole', 'Large storage compartment, prominent in plant cells')], 'flashcards', .55, .25);
    await mk('gen', 'Genetics', bio, [
      C('Allele', 'A variant form of a gene'), C('Genotype', 'The genetic makeup of an organism'), C('Phenotype', 'The observable traits that result from genotype and environment'),
      C('Punnett square', 'Grid that predicts offspring genotypes from two parents'), C('Heterozygous', 'Two different alleles for a gene'), C('Mitosis', 'Cell division producing two identical diploid cells'),
      C('Meiosis', 'Cell division producing four genetically distinct gametes'), F('DNA is transcribed into ___ before translation.', 'mRNA')], 'flashcards', .35, .3);
    await mk('meta', 'Metabolism', bio, [
      C('ATP', 'The cell’s main energy currency'), C('Glycolysis', 'Splits glucose into two pyruvate in the cytoplasm'), C('Krebs cycle', 'Oxidises acetyl-CoA in the mitochondrial matrix, producing NADH and FADH₂'),
      C('Electron transport chain', 'Uses NADH and FADH₂ to pump protons and drive ATP synthase'), C('Fermentation', 'Regenerates NAD⁺ without oxygen')], 'flashcards', .2, .4);

    await mk('travel', 'Vocabulary: Travel', spa, [
      C('Aeropuerto', 'Airport'), C('Billete', 'Ticket'), C('Equipaje', 'Luggage'), C('Habitación', 'Room'), C('Llegada', 'Arrival'), C('Salida', 'Departure / exit'),
      C('La cuenta', 'The bill'), C('Estación', 'Station'), C('Reserva', 'Reservation'), C('Pasaporte', 'Passport')], 'flashcards', .8, .1);
    await mk('verbs', 'Verb Conjugation', spa, [
      C('Ser (yo)', 'soy'), C('Estar (nosotros)', 'estamos'), C('Tener (tú)', 'tienes'), C('Ir (ellos)', 'van'), C('Hacer (yo)', 'hago'), C('Poder (nosotros)', 'podemos'),
      C('Querer (ella)', 'quiere'), C('Decir (yo)', 'digo')], 'flashcards', .5, .25);
    await mk('quizEs', 'Spanish Verbs Quiz', spa, [
      mcq('“Nosotros ___ en Madrid.” (estar)', ['estoy', 'estamos', 'están', 'estás'], 'estamos'), tf('“Yo hago” is the first-person form of hacer.', true),
      fitb('Ellos ___ al cine. (ir)', 'van'), mcq('Which means “you have” (informal)?', ['tengo', 'tiene', 'tienes', 'tenemos'], 'tienes'),
      fitb('Yo ___ español. (hablar)', 'hablo'), tf('“Ser” and “estar” are interchangeable.', false, 'Ser is for identity and permanent traits; estar for states and locations.')], 'quiz');

    await mk('linalg', 'Linear Algebra Essentials', null, [
      C('Eigenvector', 'A nonzero vector whose direction is unchanged by a linear map', 'Av = λv'), C('Eigenvalue', 'The scalar λ by which an eigenvector is stretched'),
      C('Determinant', 'Signed volume scaling factor of a linear map'), C('Rank', 'Dimension of the column space'), C('Orthogonal', 'Vectors whose dot product is zero'),
      C('Basis', 'A linearly independent set that spans the space'), C('Null space', 'All vectors x with Ax = 0'), C('Transpose', 'Flip a matrix over its diagonal')], 'flashcards', .45, .3);
    await mk('art', 'Art History: Renaissance', null, [
      C('Chiaroscuro', 'Strong contrast between light and dark to model form'), C('Sfumato', 'Soft, smoky blending of tones without hard outlines'), C('Linear perspective', 'Converging lines create the illusion of depth'),
      C('Contrapposto', 'Weight shifted onto one leg for a natural pose'), C('Fresco', 'Painting on wet plaster'), C('Humanism', 'Renaissance focus on human potential and classical learning')], 'flashcards', .3, .35);
    await mk('study', 'Study Skills', null, [
      C('Spaced repetition', 'Review at increasing intervals to fight forgetting'), C('Active recall', 'Retrieve answers from memory instead of rereading'),
      C('Pomodoro', '25 minutes of focus followed by a 5-minute break'), C('Interleaving', 'Mix topics within a session to improve transfer')], 'flashcards', 1, 0);

    await mk('orgo', 'Organic Chemistry Reactions', null, [
      C('SN2', 'One-step substitution with backside attack and inversion of configuration'), C('SN1', 'Two-step substitution through a carbocation; racemises'), C('E2', 'Concerted elimination needing an anti-periplanar H and a strong base'),
      C('Markovnikov’s rule', 'In HX addition the H goes to the carbon that already has more hydrogens'), C('Grignard reagent', 'R–MgX: a strong nucleophile and base that attacks carbonyls'), C('Aldol condensation', 'Enolate adds to a carbonyl, then dehydrates to an enone')], 'flashcards', .2, .5);
    await mk('ww1', 'World History: The Great War', null, [
      C('Triple Entente', 'Alliance of France, Russia and Britain'), C('Schlieffen Plan', 'German strategy to defeat France quickly before turning on Russia'), C('Treaty of Versailles', '1919 settlement that imposed reparations and war guilt on Germany'),
      C('Trench warfare', 'Static front-line fighting defined by machine guns and barbed wire'), C('Zimmermann Telegram', 'German offer to Mexico that pushed the US toward war')], 'flashcards', .6, .2);
    await mk('py', 'Python Data Structures', null, [
      C('list', 'Ordered, mutable sequence; O(1) append, O(n) insert at the front'), C('dict', 'Hash map with average O(1) lookup; insertion-ordered since 3.7'), C('set', 'Unordered collection of unique hashable items'),
      C('tuple', 'Immutable ordered sequence; hashable if its items are'), C('deque', 'Double-ended queue with O(1) appends and pops at both ends'), C('heapq', 'Binary min-heap on top of a list'), C('defaultdict', 'dict that creates missing values from a factory')], 'flashcards', .7, .15);
    await mk('music', 'Music Theory Basics', null, [
      C('Major scale', 'Whole, whole, half, whole, whole, whole, half'), C('Tritone', 'Interval of six semitones; the “devil in music”'), C('Circle of fifths', 'Shows key signatures a perfect fifth apart'),
      C('Dominant seventh', 'Major triad plus a minor seventh; wants to resolve to the tonic'), C('Cadence', 'Chord progression that closes a phrase')], 'flashcards', .4, .3);
    await mk('quizPy', 'Python Basics Quiz', null, [
      mcq('Which structure has O(1) average lookup by key?', ['list', 'dict', 'tuple', 'deque'], 'dict'), tf('A tuple can be changed after it is created.', false),
      fitb('The ___ keyword defines a function in Python.', 'def'), mcq('What does len([1, 2, 3]) return?', ['2', '3', '4', 'Error'], '3'),
      tf('Sets keep duplicate values.', false), fitb('Lists are created with square ____.', 'brackets')], 'quiz');

    // ── History: ~170 days of believable studying ─────────────────────
    const cards = await db.getAllCards();
    const flash = cards.filter((c) => !c.choices);
    const byDeck = {}; flash.forEach((c) => (byDeck[c.deckId] ||= []).push(c));
    const hardTerms = new Set(['Slow start', 'AIMD', 'TCP CUBIC', 'Bellman–Ford', 'Krebs cycle', 'Electron transport chain', 'Eigenvector']);
    const hard = flash.filter((c) => hardTerms.has(c.term));
    const weights = [[decks.http, 3], [decks.tcp, 5], [decks.cc, 5], [decks.ip, 3], [decks.cell, 3], [decks.gen, 2], [decks.meta, 2], [decks.travel, 2], [decks.verbs, 1], [decks.linalg, 2], [decks.art, 1], [decks.formulas, 2], [decks.orgo, 2], [decks.ww1, 1], [decks.py, 2], [decks.music, 1]];
    const pickDeck = () => { const t = weights.reduce((a, [, w]) => a + w, 0); let r = Math.random() * t; for (const [id, w] of weights) { if ((r -= w) <= 0) return id; } return weights[0][0]; };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = []; const now = new Date();
    const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (let back = 170; back >= 0; back--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      const recent = back <= 11;                                   // an unbroken 12-day streak ending today
      const dow = day.getDay();
      if (!recent && (rnd() < (back > 120 ? .72 : back > 60 ? .45 : .22))) continue;
      let n = Math.round((back > 120 ? 8 : back > 60 ? 14 : 22) + rnd() * (dow === 0 || dow === 6 ? 14 : 26) + (dow === 1 ? 8 : 0));
      if (back === 0) n = 18;                                       // today so far
      const acc = 0.6 + 0.26 * (1 - back / 170) + (rnd() - .5) * .08;
      const hours = [8, 9, 13, 20, 21, 22, 22, 23];
      const baseHour = hours[Math.floor(rnd() * hours.length)];
      for (let i = 0; i < n; i++) {
        const useHard = rnd() < .14 && hard.length;
        const card = useHard ? hard[Math.floor(rnd() * hard.length)] : (() => { const list = byDeck[pickDeck()] || flash; return list[Math.floor(rnd() * list.length)]; })();
        const ok = rnd() < (useHard ? .32 : acc);
        const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), baseHour + Math.floor((i * 4) / 60), (i * 4) % 60, Math.floor(rnd() * 60));
        if (back === 0 && ts > now) ts.setTime(now.getTime() - (n - i) * 90000);
        rows.push({ ts: ts.getTime(), date: local(ts), deckId: card.deckId, cardId: card.id, result: rnd() < .04 ? 'skip' : ok ? 'know' : 'forgot', type: card.type === 'cloze' ? 'cloze' : 'standard', ms: Math.round(2500 + rnd() * 7000) });
      }
    }
    const quizCards = (id) => cards.filter((c) => c.deckId === id);
    const attempt = (deckId, name, pct, daysAgo, total) => {
      const qs = quizCards(deckId); const correct = Math.round(qs.length * pct / 100); const when = new Date(now.getTime() - daysAgo * 864e5);
      return { deckId, deckName: name, mode: 'immediate', correct, total: qs.length, percent: Math.round((correct / qs.length) * 100), startedAt: when.toISOString(), finishedAt: new Date(when.getTime() + 8 * 60000).toISOString(), durationMs: 8 * 60000, answers: qs.map((q, i) => ({ cardId: q.id, correct: i < correct, overridden: false })) };
    };
    await new Promise((resolve) => {
      const tx = db.db.transaction(['reviews', 'quizResults'], 'readwrite');
      rows.forEach((r) => tx.objectStore('reviews').add(r));
      [[58, 41], [67, 30], [75, 19], [83, 9], [92, 2]].forEach(([p, d]) => tx.objectStore('quizResults').add(attempt(decks.quizNet, 'Networks Midterm Practice', p, d)));
      [[67, 12], [83, 6], [100, 1]].forEach(([p, d]) => tx.objectStore('quizResults').add(attempt(decks.quizEs, 'Spanish Verbs Quiz', p, d)));
      tx.oncomplete = resolve;
    });
    localStorage.setItem('retention_daily_goal', '25');
    const { THEMES } = await import('/js/themes.js');
    localStorage.setItem('theme_favorites', JSON.stringify(['light', 'dark', 'library', 'fjord', 'storm', 'city']));
    localStorage.setItem('retention_theme_favorites', JSON.stringify(['light', 'dark', 'library', 'fjord', 'storm', 'city']));
  });
};

const browser = await chromium.launch({channel: 'chrome'});
const newPage = async (theme) => {
  const ctx = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: DPR});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(URL);
  await seedData(page);
  await page.evaluate((t) => localStorage.setItem('theme', t), theme);
  await page.reload();
  await page.addStyleTag({content: '#btn-scenery, #db-toast { display: none !important; } * { caret-color: transparent; }'});
  await page.waitForTimeout(1800);
  return {ctx, page};
};
const shoot = async (page, name) => {
  await page.mouse.move(W - 5, H - 5);
  await page.waitForTimeout(500);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({path: file});
  try { execSync(`ffmpeg -y -loglevel error -i ${file} -vf crop=2656:1660:0:0 ${file}.tmp.png && mv ${file}.tmp.png ${file}`); } catch {}
  console.log('saved', file);
};

// 1 — Dashboard (Light)
if (!ONLY || ONLY === '1') {
  const {ctx, page} = await newPage('light');
  await page.locator('#sidebar-nav .db-nav-item', {hasText: 'Computer Networks'}).locator('.db-nav-toggle').click().catch(() => {});
  await page.waitForTimeout(500);
  await shoot(page, '01-dashboard-workspace');
  await ctx.close();
}
// 2 — Study: fill-in-the-blank (Night Library)
if (!ONLY || ONLY === '2') {
  const {ctx, page} = await newPage('library');
  await page.locator('.db-card', {hasText: 'Biology 101'}).first().click(); await page.waitForTimeout(600);
  await page.locator('.db-card', {hasText: 'Cell Biology'}).first().click();
  await page.waitForTimeout(700);
  for (let i = 0; i < 14 && !(await page.locator('#cloze-area').isVisible()); i++) {
    await page.click('#flashcard'); await page.waitForTimeout(150); await page.keyboard.press(i % 3 === 1 ? '1' : '3'); await page.waitForTimeout(200);
  }
  const term = await page.locator('#fc-term').innerText();
  const answer = term.includes('photosynthesis') ? 'chloroplast' : term.includes('secretion') ? 'Golgi' : term.includes('selectively') ? 'plasma' : 'mitochondria';
  await page.fill('#cloze-input', answer.replace('chloroplast', 'chloroplast'));
  await page.click('#btn-cloze-check');
  await shoot(page, '02-study-fill-in-the-blank');
  await ctx.close();
}
// 3 — Practice quiz (Fjord)
if (!ONLY || ONLY === '3') {
  const {ctx, page} = await newPage('fjord');
  await page.locator('#sidebar-nav .db-nav-item', {hasText: 'Computer Networks'}).locator('.db-nav-toggle').click().catch(() => {});
  await page.locator('.db-card', {hasText: 'Computer Networks'}).first().click(); await page.waitForTimeout(500);
  await page.locator('.db-card', {hasText: 'Exam Prep'}).first().click(); await page.waitForTimeout(500);
  await page.locator('.db-card', {hasText: 'Networks Midterm'}).first().locator('h3').click(); await page.waitForTimeout(900);
  const q = (n) => page.locator('.pt-question').nth(n);
  await q(0).locator('.pt-choice').nth(1).click(); await page.waitForTimeout(250);     // TCP (correct)
  await q(1).locator('.pt-choice').nth(0).click(); await page.waitForTimeout(250);     // wrong on purpose
  await q(2).locator('.pt-input').fill('IP'); await q(2).locator('.pt-check').click(); await page.waitForTimeout(250);
  await q(3).locator('.pt-choice').nth(2).click(); await page.waitForTimeout(250);
  await q(4).locator('.pt-choice').nth(1).click(); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('.db-body').scrollTo(0, 0));
  await shoot(page, '03-practice-quiz');
  await ctx.close();
}
// 4 — Progress (Dark)
if (!ONLY || ONLY === '4') {
  const {ctx, page} = await newPage('dark');
  await page.click('#btn-sidebar-progress'); await page.waitForTimeout(1200);
  const cells = await page.locator('.pg-hm[data-date]').evaluateAll((els) => els.map((e) => [e.dataset.date, e.getAttribute('class')]));
  const target = [...cells].reverse().find(([, c]) => /l[34]/.test(c)) || cells[cells.length - 3];
  await page.locator(`.pg-hm[data-date="${target[0]}"]`).hover(); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.db-body').scrollTo(0, 90));
  await page.locator(`.pg-hm[data-date="${target[0]}"]`).hover(); await page.waitForTimeout(300);
  await shoot(page, '04-progress-insights');
  await ctx.close();
}
// 5 — Animated theme (City Lights), collapsed sidebar so the whole skyline shows
if (!ONLY || ONLY === '5') {
  const {ctx, page} = await newPage('city');
  await page.evaluate(() => localStorage.setItem('sidebar_collapsed', '1'));
  await page.reload();
  await page.addStyleTag({content: '#btn-scenery, #db-toast { display: none !important; }'});
  await page.waitForTimeout(1500);
  await page.locator('.db-card', {hasText: 'Computer Networks'}).first().click(); await page.waitForTimeout(500);
  await page.locator('.db-card', {hasText: 'Exam Prep'}).first().click(); await page.waitForTimeout(2500);
  await shoot(page, '05-animated-theme-city-lights');
  await ctx.close();
}
await browser.close();
