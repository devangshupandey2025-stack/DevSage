export type NormalizedEvent =
  | { type: 'push'; data: PushEvent }
  | { type: 'tag_created'; data: TagEvent }
  | { type: 'tag_deleted'; data: TagEvent }
  | { type: 'installation'; data: InstallationEvent }
  | { type: 'installation_repos_added'; data: InstallationReposEvent }
  | { type: 'installation_repos_removed'; data: InstallationReposEvent };

export interface PushEvent {
  ref: string;
  before: string;
  after: string;
  forced: boolean;
  pusher: { login: string; email?: string };
  commits: Array<{
    sha: string;
    message: string;
    author: { username?: string; email: string };
    timestamp: string;
  }>;
  repository: { owner: string; name: string; full_name: string };
}

export interface TagEvent {
  ref: string;
  tag_name: string;
  sha: string;
  action: 'created' | 'deleted';
  sender: { login: string };
  repository: { owner: string; name: string; full_name: string };
}

export interface InstallationEvent {
  action: string;
  installation_id: number;
  sender: { login: string };
  repositories: Array<{ full_name: string; name: string }>;
}

export interface InstallationReposEvent {
  installation_id: number;
  sender: { login: string };
  repositories: Array<{ full_name: string; name: string }>;
}

export function normalizeGitHubEvent(
  eventType: string,
  payload: Record<string, unknown>
): NormalizedEvent | null {
  switch (eventType) {
    case 'push':
      return normalizePush(payload);
    case 'create':
      if ((payload as { ref_type?: string }).ref_type === 'tag') {
        return normalizeTagCreate(payload);
      }
      return null;
    case 'delete':
      if ((payload as { ref_type?: string }).ref_type === 'tag') {
        return normalizeTagDelete(payload);
      }
      return null;
    case 'installation':
      return normalizeInstallation(payload);
    case 'installation_repositories':
      return normalizeInstallationRepos(payload);
    default:
      return null;
  }
}

function normalizePush(p: Record<string, unknown>): NormalizedEvent {
  const payload = p as {
    ref: string; before: string; after: string; forced: boolean;
    pusher: { name: string; email?: string };
    commits: Array<{
      id: string; message: string;
      author: { username?: string; email: string };
      timestamp: string;
    }>;
    repository: { owner: { login: string }; name: string; full_name: string };
  };

  return {
    type: 'push',
    data: {
      ref: payload.ref,
      before: payload.before,
      after: payload.after,
      forced: payload.forced,
      pusher: { login: payload.pusher.name, email: payload.pusher.email },
      commits: payload.commits.map(c => ({
        sha: c.id,
        message: c.message,
        author: { username: c.author.username, email: c.author.email },
        timestamp: c.timestamp,
      })),
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
        full_name: payload.repository.full_name,
      },
    },
  };
}

function normalizeTagCreate(p: Record<string, unknown>): NormalizedEvent {
  const payload = p as {
    ref: string; master_branch: string;
    sender: { login: string };
    repository: { owner: { login: string }; name: string; full_name: string };
  };

  return {
    type: 'tag_created',
    data: {
      ref: `refs/tags/${payload.ref}`,
      tag_name: payload.ref,
      sha: '', // SHA not available in create event — will be resolved from API
      action: 'created',
      sender: { login: payload.sender.login },
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
        full_name: payload.repository.full_name,
      },
    },
  };
}

function normalizeTagDelete(p: Record<string, unknown>): NormalizedEvent {
  const payload = p as {
    ref: string;
    sender: { login: string };
    repository: { owner: { login: string }; name: string; full_name: string };
  };

  return {
    type: 'tag_deleted',
    data: {
      ref: `refs/tags/${payload.ref}`,
      tag_name: payload.ref,
      sha: '',
      action: 'deleted',
      sender: { login: payload.sender.login },
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
        full_name: payload.repository.full_name,
      },
    },
  };
}

function normalizeInstallation(p: Record<string, unknown>): NormalizedEvent {
  const payload = p as {
    action: string;
    installation: { id: number };
    sender: { login: string };
    repositories?: Array<{ full_name: string; name: string }>;
  };

  return {
    type: 'installation',
    data: {
      action: payload.action,
      installation_id: payload.installation.id,
      sender: { login: payload.sender.login },
      repositories: payload.repositories || [],
    },
  };
}

function normalizeInstallationRepos(p: Record<string, unknown>): NormalizedEvent {
  const payload = p as {
    action: string;
    installation: { id: number };
    sender: { login: string };
    repositories_added?: Array<{ full_name: string; name: string }>;
    repositories_removed?: Array<{ full_name: string; name: string }>;
  };

  const repos = payload.action === 'added'
    ? payload.repositories_added || []
    : payload.repositories_removed || [];

  return {
    type: payload.action === 'added' ? 'installation_repos_added' : 'installation_repos_removed',
    data: {
      installation_id: payload.installation.id,
      sender: { login: payload.sender.login },
      repositories: repos,
    },
  };
}
