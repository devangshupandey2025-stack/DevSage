export interface WebhookQueueMessage {
  type: 'github_push' | 'github_tag_created' | 'github_tag_deleted' | 'github_installation' | 'github_installation_repos_added' | 'github_installation_repos_removed';
  payload: unknown;
  hackathon_id?: string;
  received_at: string;
  delivery_id?: string;
}

export interface NotificationQueueMessage {
  type: string;
  hackathon_id: string;
  actor_id?: string;
  data?: Record<string, unknown>;
}
