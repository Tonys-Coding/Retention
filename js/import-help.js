/**
 * import-help.js — CSV import instructions and the downloadable AI prompt,
 * shared by the extension popup and the dashboard (web + mobile).
 */

export const AI_PROMPT_MARKDOWN = `# Retention: CSV Generation Skill

You are an AI assistant creating study material for **Retention**, a flashcard and practice-quiz app. The user will give you notes, a document, or a topic. Produce a downloadable **.csv file** in ONE of the two formats below.

- If the user asks for **flashcards**, use Format 1.
- If the user asks for a **practice test, quiz, or exam questions**, use Format 2.
- If it's unclear which they want, ask.

## Core directives
- Extract the most important concepts, facts, and terms from the material.
- Focus on actual terms, core concepts, and mechanics. Skip history and background fluff.
- Scale intelligently: be thorough for dense material, brief for sparse material.
- Wrap every field in double quotes. Escape a double quote inside a field by doubling it ("").

## Format 1: Flashcards
The header row must be exactly:
Term, Definition, Type, Example, Status

The Type column must be \`standard\` or \`fitb\`.

1. \`standard\` (flashcard)
   - Term MUST be phrased as a clear question (e.g. "What is the function of X?", "Define X"). Never just a standalone word.
   - Definition MUST be a single ultra-short fragment or sentence (MAXIMUM 15 WORDS).
2. \`fitb\` (fill-in-the-blank flashcard)
   - Term is the full sentence (MAXIMUM 15 WORDS) with the answer included. Do NOT replace the answer with "___".
   - Definition is the 1 to 2 words to hide.

Status is always \`new\`. Example is optional.

### Example (Format 1)
Term, Definition, Type, Example, Status
"What is the powerhouse of the cell?","Mitochondria","standard","It generates ATP.","new"
"The mitochondria generates most of the cell's ATP.","mitochondria","fitb","","new"

## Format 2: Practice quiz
The header row must be exactly:
Question, Type, Answer, Choice A, Choice B, Choice C, Choice D, Explanation

(Add Choice E and Choice F columns only if a question needs more than four choices.)

The Type column must be \`mcq\`, \`tf\`, or \`fitb\`. Mix types (roughly 60% mcq, 20% tf, 20% fitb) unless the user asks otherwise.

1. \`mcq\` (multiple choice)
   - Question is a clear, complete question.
   - Choices: exactly ONE correct choice and three plausible wrong choices of similar length and style. Avoid "all of the above" / "none of the above" unless the material calls for it.
   - Answer is the LETTER of the correct choice (A, B, C, D…). Vary which letter is correct.
2. \`tf\` (true / false)
   - Question is a single factual statement, not a question.
   - Answer is \`True\` or \`False\`. Mix true and false; make false statements plausible by changing one key detail.
   - Leave the Choice columns empty.
3. \`fitb\` (fill in the blank)
   - Question is one sentence with ___ where the missing word(s) go.
   - Answer is the missing word(s), 1 to 3 words. Separate other accepted answers with | (e.g. \`TCP|Transmission Control Protocol\`).
   - Leave the Choice columns empty.

Explanation is optional for every type: one short sentence explaining why the answer is correct.

### Example (Format 2)
Question, Type, Answer, Choice A, Choice B, Choice C, Choice D, Explanation
"Which of the following is NOT an advantage of a database system?","mcq","B","Maintains data quality","Increases data redundancy","Handles security and synchronizes user access","Provides data independence","Database systems reduce redundancy rather than increase it."
"A DBMS only stores data and does not manage user access.","tf","False","","","","","A DBMS also handles security and concurrent access."
"A DBMS helps ensure data ___ and security.","fitb","integrity","","","","","Integrity constraints keep data accurate and consistent."
`;

export const downloadAiPrompt = () => {
    const blob = new Blob([AI_PROMPT_MARKDOWN], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Retention_AI_Skill.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const code = (text) => `<code class="import-help-tag">${text}</code>`;

/** Renders the Flashcards / Practice Quiz format instructions into `container`. */
export const renderImportHelp = (container) => {
    container.innerHTML = `
        <p class="import-help-intro">You can select <strong>multiple CSV files at once</strong>. Each one becomes its own deck in the folder you have open.</p>
        <div class="card-mode-toggle import-help-toggle" role="group" aria-label="CSV format">
            <button type="button" class="mode-btn active" data-format="flashcards" aria-pressed="true">Flashcards</button>
            <button type="button" class="mode-btn" data-format="quiz" aria-pressed="false">Practice Quiz</button>
        </div>
        <div class="import-help-panel" data-panel="flashcards">
            <p>Headers (any order):</p>
            <div class="import-help-code">Term, Definition, Type, Example, Status</div>
            <div class="import-help-rule">
                <strong>Type: ${code('standard')} (Flashcard)</strong>
                <div>• <i>Term:</i> The front of the flashcard.</div>
                <div>• <i>Definition:</i> The back of the flashcard.</div>
            </div>
            <div class="import-help-rule">
                <strong>Type: ${code('fitb')} (Fill-in-the-blank)</strong>
                <div>• <i>Term:</i> The full sentence with the answer included.</div>
                <div>• <i>Definition:</i> The specific word(s) to hide.</div>
            </div>
        </div>
        <div class="import-help-panel" data-panel="quiz" hidden>
            <p>A CSV with a <strong>Question</strong> column becomes a <strong>practice quiz</strong> deck.</p>
            <div class="import-help-code">Question, Type, Answer, Choice A, Choice B, Choice C, Choice D, Explanation</div>
            <div class="import-help-rule">
                <strong>Type: ${code('mcq')} (Multiple choice)</strong>
                <div>• <i>Answer:</i> The letter of the correct choice (A–F).</div>
                <div>• Add Choice E / Choice F columns for more options.</div>
            </div>
            <div class="import-help-rule">
                <strong>Type: ${code('tf')} (True / false)</strong>
                <div>• <i>Question:</i> A statement. <i>Answer:</i> True or False.</div>
            </div>
            <div class="import-help-rule">
                <strong>Type: ${code('fitb')} (Fill in the blank)</strong>
                <div>• <i>Question:</i> Use ___ where the blank goes.</div>
                <div>• <i>Answer:</i> The missing word(s). Separate other accepted answers with |</div>
            </div>
            <p class="import-help-note"><i>Explanation</i> is optional and appears after a question is answered.</p>
        </div>
        <div class="import-help-ai">
            <span>Studying with an AI agent?</span>
            <a href="#" class="import-help-ai-link">Download our AI Prompt</a>
            <span class="import-help-ai-note">It can write flashcards or practice quizzes.</span>
        </div>`;

    container.querySelectorAll('[data-format]').forEach((btn) => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('[data-format]').forEach((b) => {
                const on = b === btn;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
            });
            container.querySelectorAll('[data-panel]').forEach((panel) => {
                panel.hidden = panel.dataset.panel !== btn.dataset.format;
            });
        });
    });
    container.querySelector('.import-help-ai-link').addEventListener('click', (e) => {
        e.preventDefault();
        downloadAiPrompt();
    });
};
