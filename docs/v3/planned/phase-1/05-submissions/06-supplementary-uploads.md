# Supplementary Uploads (Phase 2)

> Non-code artifacts uploaded via R2: pitch decks, screenshots, demo videos.

**Phase:** 2 — not in MVP. Design included here for schema planning.

## Concept

Teams submit code via git tags (Phase 1). In Phase 2, they can also upload supplementary files through the web UI:

- Pitch deck (PDF, PPTX)
- Screenshots (PNG, JPG)
- Demo video link or short clip
- Design files (Figma export, etc.)

## Storage

Files stored in R2 with path: `submissions/{hackathon_id}/{team_id}/{filename}`

## Future Endpoint

```
POST /api/v1/hackathons/:slug/teams/:teamId/submissions/:id/upload
Content-Type: multipart/form-data
Auth: team_lead
```

## Size Limits

- Per file: 50 MB
- Per submission: 200 MB total
- Allowed types: PDF, PPTX, PNG, JPG, MP4, WEBM, ZIP

## Schema Planning

The `submissions` table already has a `supplementary_files` JSON column reserved:

```ts
supplementary_files: text('supplementary_files'), // JSON array of { name, url, size, type }
```

## Implementation Notes

- R2 presigned URLs for direct upload (avoid Worker memory limits)
- Files are immutable once submission is finalized
- Organizers and judges can view all uploaded files
- This does NOT replace git-tag-based code submission — it supplements it
