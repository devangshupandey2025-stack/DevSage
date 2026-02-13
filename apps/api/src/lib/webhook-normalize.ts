export interface NormalizedPushEvent {
  type: 'push';
  deliveryId: string;
  timestamp: string;
  repoFullName: string;
  branch: string;
  forced: boolean;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  }>;
  headSha: string;
  beforeSha: string;
  pusherName: string;
  size?: number;
}

export interface NormalizedTagCreateEvent {
  type: 'tag_created';
  deliveryId: string;
  timestamp: string;
  repoFullName: string;
  tagName: string;
  sha: string;
  senderLogin: string;
}

export interface NormalizedTagDeleteEvent {
  type: 'tag_deleted';
  deliveryId: string;
  timestamp: string;
  repoFullName: string;
  tagName: string;
  senderLogin: string;
}

export interface NormalizedInstallationEvent {
  type: 'installation';
  deliveryId: string;
  timestamp: string;
  action: string;
  installationId: number;
  senderLogin: string;
  repositories: Array<{ fullName: string }>;
}

export type NormalizedGitHubEvent =
  | NormalizedPushEvent
  | NormalizedTagCreateEvent
  | NormalizedTagDeleteEvent
  | NormalizedInstallationEvent;

import { isRecord } from './utils.js';

function extractBranchFromRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, '');
}

export function normalizeGitHubEvent(
  eventType: string,
  payload: unknown,
  deliveryId: string
): NormalizedGitHubEvent | null {
  const timestamp = new Date().toISOString();

  if (!isRecord(payload)) {
    return null;
  }

  switch (eventType) {
    case 'push':
      return normalizePushEvent(payload, deliveryId, timestamp);

    case 'create':
      return normalizeCreateEvent(payload, deliveryId, timestamp);

    case 'delete':
      return normalizeDeleteEvent(payload, deliveryId, timestamp);

    case 'installation':
      return normalizeInstallationEvent(payload, deliveryId, timestamp);

    case 'installation_repositories':
      return normalizeInstallationRepositoriesEvent(payload, deliveryId, timestamp);

    default:
      return null;
  }
}

function normalizePushEvent(
  payload: Record<string, unknown>,
  deliveryId: string,
  timestamp: string
): NormalizedPushEvent | null {
  const { repository, head_commit: headCommit, ref, pusher, forced, before, commits } = payload;

  if (!isRecord(repository) || !isRecord(headCommit) || !isRecord(pusher)) {
    return null;
  }

  if (
    typeof repository.full_name !== 'string' ||
    typeof headCommit.id !== 'string' ||
    typeof ref !== 'string' ||
    typeof pusher.name !== 'string' ||
    typeof forced !== 'boolean' ||
    typeof before !== 'string' ||
    !Array.isArray(commits)
  ) {
    return null;
  }

  const normalizedCommits = commits
    .slice(0, 20)
    .map((commit) => {
      if (!isRecord(commit) || !isRecord(commit.author)) {
        return null;
      }

      if (
        typeof commit.id !== 'string' ||
        typeof commit.message !== 'string' ||
        typeof commit.author.name !== 'string' ||
        typeof commit.timestamp !== 'string'
      ) {
        return null;
      }

      return {
        sha: commit.id,
        message: commit.message,
        author: commit.author.name,
        timestamp: commit.timestamp,
      };
    })
    .filter((commit) => commit !== null);

  return {
    type: 'push',
    deliveryId,
    timestamp,
    repoFullName: repository.full_name,
    branch: extractBranchFromRef(ref),
    forced,
    commits: normalizedCommits,
    headSha: headCommit.id,
    beforeSha: before,
    pusherName: pusher.name,
    size: typeof payload.size === 'number' ? payload.size : undefined,
  };
}

function normalizeCreateEvent(
  payload: Record<string, unknown>,
  deliveryId: string,
  timestamp: string
): NormalizedTagCreateEvent | null {
  const { ref, ref_type: refType, repository, sender, head_commit: headCommit } = payload;

  if (!isRecord(repository) || !isRecord(sender)) {
    return null;
  }

  if (
    typeof ref !== 'string' ||
    typeof refType !== 'string' ||
    typeof repository.full_name !== 'string' ||
    typeof sender.login !== 'string'
  ) {
    return null;
  }

  if (refType !== 'tag') {
    return null;
  }

  // Extract SHA from head_commit (GitHub create event) or master_branch sha
  const sha = (isRecord(headCommit) && typeof headCommit.sha === 'string')
    ? headCommit.sha
    : (typeof payload.sha === 'string' ? payload.sha : '');

  return {
    type: 'tag_created',
    deliveryId,
    timestamp,
    repoFullName: repository.full_name,
    tagName: ref,
    sha,
    senderLogin: sender.login,
  };
}

function normalizeDeleteEvent(
  payload: Record<string, unknown>,
  deliveryId: string,
  timestamp: string
): NormalizedTagDeleteEvent | null {
  const { ref, ref_type: refType, repository, sender } = payload;

  if (!isRecord(repository) || !isRecord(sender)) {
    return null;
  }

  if (
    typeof ref !== 'string' ||
    typeof refType !== 'string' ||
    typeof repository.full_name !== 'string' ||
    typeof sender.login !== 'string'
  ) {
    return null;
  }

  if (refType !== 'tag') {
    return null;
  }

  return {
    type: 'tag_deleted',
    deliveryId,
    timestamp,
    repoFullName: repository.full_name,
    tagName: ref,
    senderLogin: sender.login,
  };
}

function normalizeInstallationEvent(
  payload: Record<string, unknown>,
  deliveryId: string,
  timestamp: string
): NormalizedInstallationEvent | null {
  const { action, installation, repositories, sender } = payload;

  if (!isRecord(installation) || !isRecord(sender)) {
    return null;
  }

  if (
    typeof action !== 'string' ||
    typeof installation.id !== 'number' ||
    typeof sender.login !== 'string' ||
    !Array.isArray(repositories)
  ) {
    return null;
  }

  const normalizedRepos = repositories
    .map((repo) => {
      if (!isRecord(repo) || typeof repo.full_name !== 'string') {
        return null;
      }
      return { fullName: repo.full_name };
    })
    .filter((repo) => repo !== null);

  return {
    type: 'installation',
    deliveryId,
    timestamp,
    action,
    installationId: installation.id,
    senderLogin: sender.login,
    repositories: normalizedRepos,
  };
}

function normalizeInstallationRepositoriesEvent(
  payload: Record<string, unknown>,
  deliveryId: string,
  timestamp: string
): NormalizedInstallationEvent | null {
  const { action, installation, repositories_added: repositoriesAdded, sender } = payload;

  if (!isRecord(installation) || !isRecord(sender)) {
    return null;
  }

  if (
    typeof action !== 'string' ||
    typeof installation.id !== 'number' ||
    typeof sender.login !== 'string' ||
    !Array.isArray(repositoriesAdded)
  ) {
    return null;
  }

  const normalizedRepos = repositoriesAdded
    .map((repo) => {
      if (!isRecord(repo) || typeof repo.full_name !== 'string') {
        return null;
      }
      return { fullName: repo.full_name };
    })
    .filter((repo) => repo !== null);

  return {
    type: 'installation',
    deliveryId,
    timestamp,
    action,
    installationId: installation.id,
    senderLogin: sender.login,
    repositories: normalizedRepos,
  };
}
