# Component Library

> shadcn/ui + Tailwind CSS v4 setup for the platform app.

## Tailwind CSS v4

All apps use Tailwind v4 (CSS-first configuration):

```css
/* apps/*/src/index.css */
@import "tailwindcss";
@import "tw-animate-css";
```

> Install: `pnpm add -D tw-animate-css`. Required for shadcn/ui component animations (Dialog, Toast, DropdownMenu transitions).

No `tailwind.config.js` in v4 — configuration is in CSS using the 4-step CSS variable architecture:

```css
/* 1. CSS Variables — define colors for light and dark */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... other dark mode values */
}

/* 2. Tailwind v4 @theme inline — maps CSS vars to Tailwind utilities */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-border: hsl(var(--border));
  --color-ring: hsl(var(--ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}

/* 3. Base styles */
@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

> **Critical**: `:root`/`.dark` must be at root level (NOT inside `@layer base`). `@theme inline` generates utility classes (`bg-background`, `text-primary`) — without it, Tailwind utilities won't exist for your CSS variables.

### components.json (Tailwind v4)

Required for shadcn/ui CLI to work with Tailwind v4:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

> The empty `config: ""` is required for Tailwind v4 — it tells shadcn/ui not to look for a `tailwind.config.ts` file.

## shadcn/ui (Platform App Only)

The platform app uses shadcn/ui for complex UI components. Components are copied into the project (not imported from a package):

```
apps/platform/src/components/ui/
├── button.tsx
├── card.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── form.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── table.tsx
├── tabs.tsx
├── toast.tsx
└── ...
```

### Adding Components

```bash
cd apps/platform
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Usage Pattern

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function CreateTeamDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Team</Button>
      </DialogTrigger>
      <DialogContent>
        <Input placeholder="Team name" />
        <Button type="submit">Create</Button>
      </DialogContent>
    </Dialog>
  );
}
```

## Dark Mode

Tailwind v4 dark mode uses the `dark` class strategy:

```tsx
<html className="dark">
```

All shadcn/ui components support dark mode out of the box.

## Implementation Notes

- Web and admin apps use plain Tailwind — no shadcn/ui (simpler needs)
- shadcn/ui components are local files, not a dependency — customize freely
- `@/` path alias maps to `src/` via tsconfig paths
- Tailwind v4 is significantly different from v3 — no `tailwind.config.js`
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes
