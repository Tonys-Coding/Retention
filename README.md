# Retention - Chrome Extension

Retention is a minimalistic, high-contrast flashcard study system built as a Chrome Extension. 

## Features
- **Custom Study Decks**: Organize terms and concepts into individual decks.
- **Flashcard Quizzes**: Study your decks with a built-in spaced-repetition-lite quiz feature.
- **Progress Tracking**: Cards are marked as 'learning' or 'mastered' based on your quiz performance.
- **CSV Import/Export**: Easily backup or share your decks using standard CSV files.
- **Offline Mode**: Fully functional without an internet connection using IndexedDB for local storage.
- **High-Contrast Aesthetic**: Sleek black and white design with a geometric pattern for minimal distractions.

## Installation
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click on **Load unpacked**.
4. Select the directory containing this extension (`Retention Flashcard Chrome Extension`).

## Usage
- Click the extension icon in your toolbar to open the Retention popup.
- Create a new deck or import an existing one via CSV.
- Add cards to your deck with a term, optional part of speech, definition, and example.
- Click **Study** to begin a quiz session for a deck.
- Tap a flashcard to flip it and view the definition.
- Mark whether you knew the answer or forgot it to track your progress.
