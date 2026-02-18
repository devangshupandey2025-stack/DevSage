import React from 'react';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_name?: string;
  created_at: string;
}

interface AnnouncementsTabProps {
  announcements: Announcement[];
  isLoading?: boolean;
}

export const AnnouncementsTab: React.FC<AnnouncementsTabProps> = ({ announcements, isLoading }) => {
  if (isLoading) {
    return <div className="text-white/60 py-8 text-center">Loading announcements…</div>;
  }
  if (!announcements.length) {
    return <div className="text-white/40 py-8 text-center">No announcements yet.</div>;
  }
  return (
    <div className="space-y-6">
      {announcements.map(a => (
        <div key={a.id} className="rounded-lg bg-white/5 p-4 border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white text-base">{a.title}</span>
            <span className="text-xs text-white/40">{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div className="text-white/80 mb-2">{a.content}</div>
          {a.author_name && (
            <div className="text-xs text-white/40">By {a.author_name}</div>
          )}
        </div>
      ))}
    </div>
  );
};
