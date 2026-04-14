# 🔍 Patch the Reality

> Community-powered media verification platform — fight misinformation with crowd intelligence.

🌐 **Live:** [patch-the-reality.vercel.app](https://patch-the-reality.vercel.app)

---

## What is it?

**Patch the Reality** is a crowd-sourced fact verification platform where users submit suspicious images, videos, and text for community review. AI pre-screens the content, flags potential deepfakes or misinformation, and the community votes to verify or debunk it — earning tokens for accurate verdicts.

---

## Features

- 🤖 **Multi-Model AI Detection** — automatically analyzes uploaded media for signs of AI generation or manipulation
- 🗳️ **Community Voting** — users vote YES/NO on whether content is genuine
- 🪙 **Token Rewards** — earn tokens for participating and voting correctly
- 📊 **Live Feed** — real-time poll feed with category filters (Breaking, Science, Politics, Nature, Health, Finance, Tech)
- 👤 **User Profiles** — track your accuracy score, reputation, and earnings
- 🔗 **Solana Integration** — token minting and burning on the Solana blockchain
- 📱 **Responsive Design** — works on desktop and mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| AI Analysis | Multi-model AI detection |
| Blockchain | Solana Web3.js |
| Animations | Framer Motion |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- API keys for AI models

### Installation

```bash
git clone https://github.com/rajeshsingh241/patch-the-reality.git
cd patch-the-reality
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

1. **Upload** — user submits an image, video, or text claim
2. **AI Analysis** — system runs multi-model detection and generates a verification question
3. **Community Poll** — the content goes live as a poll for the community to vote on
4. **Verdict** — once enough votes are collected, the poll closes and accurate voters earn tokens
5. **Reputation** — consistent accurate voters gain reputation (Newcomer → Contributor → Trusted → Expert)

---

## Project Structure

```
src/
├── app/
│   ├── api/          # API routes (polls, users, AI, Solana)
│   ├── poll/         # Individual poll page
│   ├── upload/       # Upload & verification flow
│   └── profile/      # User profile page
├── components/
│   ├── HomeClient    # Main feed
│   ├── PollCard      # Poll card component
│   ├── UploadClient  # Upload flow
│   └── ProfileClient # Profile page
└── lib/
    ├── supabase.ts   # Database client
    ├── tokenService  # Token logic
    └── solanaService # Blockchain integration
```

---

## Built at Hackathon

This project was built as part of a hackathon with the goal of making media verification accessible, incentivized, and community-driven.

---

## License

MIT