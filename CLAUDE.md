# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 literature tracing tool (文献溯源工具) built with TypeScript and shadcn/ui components. The application allows users to input text content and intelligently finds related academic literature, displaying results by sentence with supporting references.

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Start production server
npm run start
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **UI Components**: Radix UI primitives with custom shadcn/ui implementation
- **Font**: Geist Sans and Geist Mono
- **State Management**: React hooks (useState)
- **Icons**: Lucide React
- **Analytics**: Vercel Analytics

### Project Structure

```
app/
  layout.tsx          # Root layout with font setup and analytics
  page.tsx            # Home page with LiteratureTracer component
  globals.css         # Global styles and Tailwind imports

components/
  literature-tracer.tsx  # Main application component with search and results
  theme-provider.tsx     # Theme management (dark/light mode)
  ui/                    # shadcn/ui component library
    button.tsx, card.tsx, input.tsx, etc.

lib/
  utils.ts           # Utility functions (cn for className merging)

hooks/
  use-mobile.ts      # Mobile detection hook
  use-toast.ts       # Toast notification hook
```

### Key Components

**LiteratureTracer** (`components/literature-tracer.tsx`):
- Main application component handling text input and literature search
- Splits input text into sentences and finds relevant academic papers
- Displays results in two tabs (接口一结果, 接口二结果) with mock data
- Features copy functionality for titles, DOIs, abstracts, and citations

**UI Components**:
- Uses shadcn/ui components with "new-york" style
- Components are built on Radix UI primitives
- Custom styling with Tailwind CSS and CSS variables

### Configuration

- **TypeScript**: Strict mode enabled with path aliases (`@/*`)
- **Next.js**: ESLint and TypeScript errors ignored during builds for development
- **Tailwind**: Configured with CSS variables for theming
- **PostCSS**: Uses Tailwind CSS PostCSS plugin

### Data Structure

The application uses mock data with the following structure:

```typescript
interface Literature {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  verified: boolean
  supportingPages?: number
  abstract?: string
  impactFactor?: number
  citationCount?: number
}

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}
```

### Development Notes

- The application currently uses mock data for demonstration
- Search functionality simulates API calls with 1.5-second delays
- Text is split into sentences using Chinese and English punctuation
- Results are organized by sentence with supporting literature references
- UI includes sample queries for quick testing
- Copy functionality available for various citation formats