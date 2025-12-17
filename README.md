# Proselenos

**Proselenos** is a full-stack Next.js web application that serves as a combined **e-book reader** and **writing platform**.

**Live at:** [proselenos.com](https://proselenos.com) (hosted on Vercel)

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS + DaisyUI, Zustand
- **Backend:** Supabase (PostgreSQL, auth, storage), NextAuth (Google SSO)
- **Key Libraries:** foliate-js (EPUB rendering), OpenAI API, edge-tts (text-to-speech)

## Main Features

### For Readers:

- EPUB reader with customizable themes, fonts, and layouts
- Text-to-speech with voice selection
- Highlights, annotations, bookmarks, and notes
- Reading progress tracking and offline support
- Cloud backup for user's ebooks

### For Writers/Authors:

- AI-powered writing assistant (brainstorming, outlining, world-building, chapter writing)

## Project Structure

```
apps/
└── proselenos-app/           # Main Next.js application
    └── src/
        ├── app/              # Routes (/library, /reader, /authors, /store)
        ├── components/       # UI components
        ├── store/            # Zustand stores (library, reader, settings)
        ├── services/         # Business logic (AI, TTS, app operations)
        └── lib/              # Supabase client, server actions
packages/
├── auth-core/                # NextAuth configuration
└── foliate-js/               # EPUB rendering engine
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/library` | Personal ebook library management |
| `/reader/[bookId]` | Full-featured EPUB reader (opened by clicking a book) |
| `/authors` | Author dashboard (includes writing tools) |
| `/store` | Public ebook bookstore |

The app supports **24+ languages** via i18next internationalization.
