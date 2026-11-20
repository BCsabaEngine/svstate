# Demo subproject (demo/)

The `demo/` directory is a separate npm project for interactive testing of the library.

**Structure:**

- `demo/src/App.svelte` - Root component
- `demo/src/pages/` - Demo pages (e.g., `BasicValidation.svelte`); each page that creates a state calls `destroy()` on unmount (`onDestroy(destroy)`) so timers, channels and plugins don't outlive it. The selected page is kept in the URL hash
- `demo/src/components/` - Shared UI components (e.g., `ErrorText.svelte`)

**Stack:** Vite + Svelte 5 + Tailwind CSS 4

**Working directly in demo:**

```bash
cd demo
npm install             # Install demo dependencies (separate from root)
npm run dev             # Start dev server
npm run build           # Production build
npm run ts:check        # TypeScript check
npm run all             # format → lint → ts:check → build
```

Note: The demo has its own `node_modules` and uses Zod for some validation examples.
