import { createDbClient, teamRepos } from '@devsage/db';
import { eq } from 'drizzle-orm';
import type { NormalizedInstallationEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';
import type { Env } from '../types/env.js';

export async function handleInstallation(event: NormalizedInstallationEvent, env: Env): Promise<void> {
  const db = createDbClient(env.DB);
  const isActivation = event.action === 'created' || event.action === 'added';
  const botActive = isActivation ? 1 : 0;

  for (const repo of event.repositories) {
    await db
      .update(teamRepos)
      .set({ bot_active: botActive })
      .where(eq(teamRepos.repo_full_name, repo.fullName));
  }

  await insertAuditEvent(db, {
    actorType: 'bot',
    eventType: `installation.${event.action}`,
    entityType: 'installation',
    entityId: String(event.installationId),
    metadata: {
      repositories: event.repositories.map((r) => r.fullName),
      senderLogin: event.senderLogin,
    },
  });
}
