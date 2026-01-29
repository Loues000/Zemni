# Zemni

Transform your lecture slides into exam-ready study materials. Upload PDFs, get AI-powered summaries, flashcards, and quizzes—all optimized for your learning style.

## What is Zemni?

Zemni is an intelligent study companion that helps you prepare for exams by converting lecture slides into structured, exam-focused content. Whether you need concise summaries, interactive flashcards, or practice quizzes, Zemni adapts to your learning needs.

## Key Features

### 📚 Content Generation
- **Smart Summaries**: AI-powered summaries focused on exam-relevant content
- **Interactive Flashcards**: Study with spaced repetition, fullscreen mode, and customizable density
- **Practice Quizzes**: Multiple-choice questions with instant feedback and explanations
- **Multiple AI Models**: Choose from various AI models to match your preferences

### 🎯 Study Tools
- **PDF Processing**: Upload lecture slides and extract text automatically
- **Markdown Preview**: Real-time preview with LaTeX math support (KaTeX)
- **Export Options**: Export to Markdown, TSV, JSON, or directly to Notion
- **Iterative Refinement**: Chat with AI to improve and customize your content

### 👤 User Features
- **Secure Accounts**: Sign up and manage your account with Clerk authentication
- **Document History**: Access all your past documents and generations
- **Usage Tracking**: Monitor your token usage and costs
- **Subscription Tiers**: Choose a plan that fits your needs (Free, Basic, Plus, Pro)
- **Bring Your Own Keys**: Use your own API keys for OpenRouter, OpenAI, Anthropic, or Google
- **Notion Integration**: Export directly to your Notion workspace

## Getting Started

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Summary_Maker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your environment**
   - See [user_guide.md](user_guide.md) for detailed setup instructions
   - You'll need accounts for:
     - [Convex](https://convex.dev) (free tier available)
     - [Clerk](https://clerk.com) (free tier available)
     - [Stripe](https://stripe.com) (for subscriptions)
     - [OpenRouter](https://openrouter.ai) (for AI models)

4. **Run the development server**
   ```bash
   # Start Convex (in a separate terminal)
   npx convex dev
   
   # Start Next.js (in another terminal)
   npm run dev
   ```

5. **Open your browser**
   - Navigate to `http://localhost:3420`
   - Sign up for an account and start creating!

## Tech Stack

Built with modern web technologies:
- **Next.js 14** (App Router) with TypeScript
- **Convex** for backend database and real-time sync
- **Clerk** for user authentication
- **Stripe** for subscription management
- **OpenRouter** for AI model access
- **Vercel AI SDK** for streaming responses

## How It Works

1. **Upload**: Upload your PDF lecture slides
2. **Process**: Zemni extracts text and analyzes the content
3. **Generate**: Choose your output type (Summary, Flashcards, or Quiz)
4. **Customize**: Refine the content through chat or adjust settings
5. **Study**: Use the generated materials to prepare for exams
6. **Export**: Save to your preferred format or export to Notion

## Requirements

- **Node.js 18+** and npm
- Accounts for:
  - [Convex](https://convex.dev) - Database and backend (free tier available)
  - [Clerk](https://clerk.com) - Authentication (free tier available)
  - [Stripe](https://stripe.com) - Subscriptions (free to start)
  - [OpenRouter](https://openrouter.ai) - AI model access

For detailed setup instructions, see [user_guide.md](user_guide.md).

## Features in Detail

### Study Modes

**Summary Mode**
- Concise, exam-focused summaries
- Structured with headings and key points
- LaTeX math support
- Export to Markdown or Notion

**Flashcards Mode**
- Interactive flashcard generation
- Adjustable density (fewer/more cards)
- Fullscreen study mode
- Export to Markdown or TSV

**Quiz Mode**
- Multiple-choice questions
- Instant feedback and explanations
- Batch generation
- Export to Markdown or JSON

### User Dashboard

- View all your documents
- Search and filter by date, type, or content
- Usage statistics (tokens, costs, documents)
- Quick access to recent work

### Settings & Customization

- **Account**: Manage your profile and preferences
- **Subscription**: View and manage your plan
- **API Keys**: Add your own AI provider keys
- **Notion**: Configure per-user Notion integration
- **Models**: Choose your preferred AI models
- **History**: Export or import your document history

## Support & Documentation

- **Setup Guide**: See [user_guide.md](user_guide.md) for detailed setup instructions
- **Agent Instructions**: See [AGENTS.md](AGENTS.md) for development guidelines
- **Project Docs**: See `docs/` folder for additional documentation

## Contributing

This is a private project. For development guidelines, see [AGENTS.md](AGENTS.md).

## License

See LICENSE file for details.

