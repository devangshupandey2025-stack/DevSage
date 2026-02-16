# Templates

> Reusable hackathon configurations that organizers can clone when creating new hackathons.

## What Templates Store

A template captures the configuration of a hackathon (not the teams or submissions):

```sql
CREATE TABLE hackathon_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings TEXT NOT NULL DEFAULT '{}',  -- JSON: HackathonSettings
  tracks TEXT NOT NULL DEFAULT '[]',    -- JSON: array of track definitions
  rounds TEXT NOT NULL DEFAULT '[]',    -- JSON: array of round definitions
  rubric TEXT NOT NULL DEFAULT '[]',    -- JSON: array of rubric criteria
  is_platform_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Endpoints

```
GET    /api/v1/templates                    # List templates (user's workspace + platform defaults)
GET    /api/v1/templates/:id                # Get template details
POST   /api/v1/templates                    # Create template (organizer)
PATCH  /api/v1/templates/:id                # Update template (owner only)
DELETE /api/v1/templates/:id                # Delete template (owner only)
POST   /api/v1/templates/:id/clone          # Clone template to a new hackathon
```

## Creating from Hackathon

Organizers can save an existing hackathon's config as a template:

```
POST /api/v1/hackathons/:slug/save-as-template
Auth: organizer
Body: { name: string, description?: string }
```

Copies: settings, tracks, rounds, rubric criteria. Does NOT copy: teams, submissions, scores.

## Using a Template

When creating a hackathon with `template_id`:

```ts
// 1. Load template
const template = await db.select().from(hackathonTemplates).where(eq(id, templateId)).get();

// 2. Merge template settings with request body (request body overrides)
const settings = { ...JSON.parse(template.settings), ...body.settings };

// 3. Create hackathon with merged settings
// 4. Create tracks from template.tracks
// 5. Create rounds from template.rounds
// 6. Create rubric criteria from template.rubric
```

## Platform Defaults

Platform admins can create templates with `is_platform_default: true`. These appear for all organizers as starting points. Workspace-specific templates only appear for members of that workspace.

## Implementation Notes

- Templates are soft references — deleting a template doesn't affect hackathons created from it
- Template data is JSON columns for flexibility (no separate join tables)
- Cloning is a deep copy — changes to the template don't affect existing hackathons
