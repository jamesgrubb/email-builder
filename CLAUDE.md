# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **MJML Email Builder** built with Astro, React, and Supabase. It provides a visual email template editor with brand management, real-time preview, and Cloudinary image upload integration.

**Key Features:**
- MJML-based email template editor with Monaco Editor and autocomplete
- Live HTML preview with interactive image replacement via Cloudinary
- Brand theming system with custom fonts, colors, and styles
- Template persistence with Supabase (PostgreSQL)
- Real-time template updates via Supabase subscriptions
- Auto-save functionality (3-second debounce)

## Commands

All commands should be run from the `email-builder/` directory:

```bash
cd email-builder

# Development
npm install              # Install dependencies
npm run dev             # Start dev server at localhost:4321

# Production
npm run build           # Build for production to ./dist/
npm run preview         # Preview production build locally

# Astro CLI
npm run astro ...       # Run Astro CLI commands
npm run astro check     # Type-check the project
```

## Architecture

### Tech Stack
- **Framework**: Astro 5.x with React integration
- **Styling**: Tailwind CSS v4 (via Vite plugin)
- **Editor**: Monaco Editor (@monaco-editor/react)
- **Email Rendering**: MJML Browser (mjml-browser)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Image Upload**: Cloudinary Upload Widget
- **Icons**: Lucide React

### File Structure

```
email-builder/
├── src/
│   ├── components/
│   │   ├── EmailBuilder.jsx    # Main MJML editor component
│   │   ├── BrandBuilder.jsx    # Brand management UI
│   │   └── Toast.jsx           # Toast notification component
│   ├── pages/
│   │   ├── index.astro         # Email builder page (/)
│   │   └── brands.astro        # Brand management page (/brands)
│   ├── layouts/
│   │   └── BaseLayout.astro    # Base HTML layout with Cloudinary script
│   ├── lib/
│   │   └── supabase.ts         # Supabase client initialization
│   └── styles/
│       └── global.css          # Global styles
├── supabase/
│   └── schema.sql              # Database schema (brands + templates tables)
├── public/                     # Static assets
└── astro.config.mjs            # Astro configuration
```

### Key Components

**EmailBuilder.jsx** (`email-builder/src/components/EmailBuilder.jsx`)
- Main application component with three-panel layout (templates sidebar, Monaco editor, live preview)
- Manages MJML code state, brand selection, template CRUD operations
- Real-time MJML compilation and preview rendering
- Cloudinary integration via postMessage for image replacement
- Auto-save with 3-second debounce when editing existing templates
- Supabase real-time subscription for template updates
- Template filtering by selected brand (preset or custom)

**BrandBuilder.jsx** (`email-builder/src/components/BrandBuilder.jsx`)
- Brand creation/editing interface with color pickers
- Live MJML preview of brand styling
- Brand CRUD operations via Supabase
- Returns to main builder via navigation link

### Database Schema

**Tables** (defined in `supabase/schema.sql`):
- `brands` - Custom brand configurations (font, colors)
  - Columns: id, created_at, name, font_family, text_color, background_color, accent_color
- `templates` - Saved MJML email templates
  - Columns: id, created_at, name, mjml_code, brand_id (nullable FK), thumbnail_url

Both tables use Row Level Security (RLS) with policies allowing public CRUD operations (no authentication currently implemented).

### State Management Pattern

The application uses React's useState/useEffect for local state management:
- **Template State**: `code`, `currentTemplateId`, `currentTemplateName`, `hasUnsavedChanges`
- **Brand State**: `selectedBrand`, `savedBrandsFull`, `savedBrandNames`
- **UI State**: `isSaving`, `compileErrors`, `toast`, `editingTemplateId`
- **Cloudinary State**: `activeImageIndex` for tracking which image to replace

**Auto-save Logic**:
- Tracks changes via `originalCodeRef` comparison
- Debounces saves by 3 seconds when `currentTemplateId` exists
- Skips auto-save prompt for new templates (requires manual save with name)

### MJML Compilation Flow

1. User edits MJML code in Monaco Editor (left panel)
2. `useEffect` triggers on code/brand changes
3. Brand attributes injected into `<mj-head>` based on selection
4. `mjml2html()` compiles final MJML → HTML
5. Image click handlers injected via script tag
6. HTML rendered in preview iframe (right panel)
7. Compilation errors displayed in error panel at bottom

### Cloudinary Image Upload Flow

1. Preview iframe detects image click
2. Posts message to parent with image index
3. Parent opens Cloudinary upload widget
4. On success, widget callback receives URL
5. Code updated via regex to replace nth `<mj-image src="...">` attribute
6. Preview auto-updates via MJML recompilation

### Environment Variables

Required in `.env` (root directory):
```
PUBLIC_SUPABASE_URL=<your-supabase-project-url>
PUBLIC_SUPABASE_KEY=<your-supabase-anon-key>
```

Cloudinary configuration is hardcoded in `EmailBuilder.jsx:131-132`:
- `cloudName: 'makingthings'`
- `uploadPreset: 'astro-uploads'`

## Development Notes

### Astro + React Integration
- React components require `client:only="react"` directive in `.astro` pages
- Astro config defines Vite globals for `process` and `global` to support MJML Browser

### Monaco Editor MJML Support
- Custom autocomplete provider registered for MJML tags (`email-builder/src/components/EmailBuilder.jsx:574-590`)
- Includes snippets for common tags: mj-section, mj-column, mj-text, mj-image, mj-button, mj-divider, mj-spacer

### Brand System
- **Preset Brands**: Hardcoded in `PRESET_BRANDS` object (default, dark, simple)
- **Custom Brands**: Stored in Supabase `brands` table
- Brand selection filters templates by `brand_id` (null for presets)
- Switching brands does NOT auto-change code (only affects new templates and preview rendering)

### Template Persistence
- Templates auto-save 3 seconds after last edit (if `currentTemplateId` exists)
- New templates require manual save with name prompt
- Updates use optimistic local state updates + Supabase realtime sync
- Inline rename feature available in template list

### Common Customizations
- To change default MJML template: Edit `DEFAULT_CODE` in `EmailBuilder.jsx:41-48`
- To add preset brands: Add entries to `PRESET_BRANDS` object in `EmailBuilder.jsx:21-39`
- To modify Cloudinary config: Update widget initialization in `EmailBuilder.jsx:130-135`
