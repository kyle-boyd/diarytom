# Tom Riddle's Diary

A single-page Next.js app that mimics Tom Riddle's diary from Harry Potter: a minimalist parchment experience where you type on the page and the diary replies in character via an LLM (Gemini).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Gemini**

   Copy `.env.example` to `.env.local` and add your [Gemini API key](https://aistudio.google.com/apikey):

   ```bash
   cp .env.example .env.local
   # Edit .env.local and set GEMINI_API_KEY=your_key
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Features

- **Parchment aesthetic**: Cream background, Fraunces font, no visible borders or scrollbars.
- **Ghost interactions**: Faint “type…” / “talk to me” flashes on scroll; click to see a brief “type here” prompt.
- **Ink chat**: Type anywhere; your text appears as ink. Press Enter to “soak” your message and get a reply.
- **Diary persona**: The LLM responds as Tom Riddle’s diary (charming, clever, subtly sinister) with letter-by-letter “bleeding ink” animation.

## Tech

- Next.js (App Router), React, TypeScript  
- Tailwind CSS, Framer Motion  
- Google Gemini API via `/api/chat`
