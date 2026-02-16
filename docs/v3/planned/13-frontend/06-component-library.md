# Component Library

> shadcn/ui + Tailwind CSS v4 setup for the platform app.

## Tailwind CSS v4

All apps use Tailwind v4 (CSS-first configuration):

```css
/* apps/*/src/index.css */
@import "tailwindcss";
```

No `tailwind.config.js` in v4 — configuration is in CSS using `@theme`:

```css
@theme {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --font-sans: "Inter", sans-serif;
  --radius-lg: 0.5rem;
}
```

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
