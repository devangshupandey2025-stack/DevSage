import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/common';
import {
  Settings,
  Save,
  Calendar,
  Users,
  Globe,
  Shield,
  Trash2,
  AlertTriangle,
  Check,
  Image,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function SettingsSection({ title, icon: Icon, children }: { title: string; icon: typeof Settings; children: React.ReactNode }) {
  return (
    <motion.div variants={item} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
          <Icon className="h-4 w-4 text-white/40" />
        </div>
        <h3 className="text-sm font-bold text-white/80">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 placeholder:text-white/15 outline-none focus:border-[#CCFF00]/30 transition-colors"
      />
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-white/70">{label}</p>
        <p className="text-[10px] text-white/25 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#CCFF00]' : 'bg-white/10'
        }`}
      >
        <motion.div
          className={`absolute top-0.5 h-5 w-5 rounded-full ${checked ? 'bg-black' : 'bg-white/40'}`}
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

interface HackathonSettings {
  title: string;
  tagline: string | null;
  min_team_size: number;
  max_team_size: number;
  starts_at: string | null;
  submission_deadline: string | null;
  registration_mode: string | null;
  allow_resubmission: boolean;
  status: string;
}

export function SettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [maxTeamSize, setMaxTeamSize] = useState('5');
  const [minTeamSize, setMinTeamSize] = useState('1');
  const [startsAt, setStartsAt] = useState('');
  const [subDeadline, setSubDeadline] = useState('');
  const [publicListing, setPublicListing] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hackathonStatus, setHackathonStatus] = useState('draft');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await apiRequest<{ data: HackathonSettings }>(`/api/v1/hackathons/${slug}`);
        const h = res.data;
        setName(h.title ?? '');
        setTagline(h.tagline ?? '');
        setMinTeamSize(String(h.min_team_size ?? 1));
        setMaxTeamSize(String(h.max_team_size ?? 5));
        setStartsAt(h.starts_at ? h.starts_at.slice(0, 16) : '');
        setSubDeadline(h.submission_deadline ? h.submission_deadline.slice(0, 16) : '');
        setRequireApproval(h.registration_mode === 'approval');
        setAllowLateSubmissions(h.allow_resubmission ?? false);
        setHackathonStatus(h.status);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleSave = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      await apiRequest(`/api/v1/hackathons/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          tagline,
          min_team_size: parseInt(minTeamSize),
          max_team_size: parseInt(maxTeamSize),
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          registration_mode: requireApproval ? 'approval' : 'open',
          allow_resubmission: allowLateSubmissions,
        }),
      });
      toast.success('Settings saved successfully.');
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slug) return;
    try {
      await apiRequest(`/api/v1/hackathons/${slug}`, { method: 'DELETE' });
      toast.success('Hackathon deleted.');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete hackathon. Only draft hackathons can be deleted.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#CCFF00]"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure hackathon parameters and preferences."
        actions={
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(204,255,0,0.25)]"
          >
            {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black"
              />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        }
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {/* General */}
        <SettingsSection title="General" icon={Settings}>
          <div className="space-y-4">
            <InputField label="Hackathon Name" value={name} onChange={setName} />
            <InputField label="Tagline" value={tagline} onChange={setTagline} placeholder="Short description..." />
          </div>
        </SettingsSection>

        {/* Dates */}
        <SettingsSection title="Dates & Deadlines" icon={Calendar}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Starts At" value={startsAt} onChange={setStartsAt} type="datetime-local" />
            <InputField label="Submission Deadline" value={subDeadline} onChange={setSubDeadline} type="datetime-local" />
          </div>
        </SettingsSection>

        {/* Teams */}
        <SettingsSection title="Team Configuration" icon={Users}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Min Team Size" value={minTeamSize} onChange={setMinTeamSize} type="number" />
            <InputField label="Max Team Size" value={maxTeamSize} onChange={setMaxTeamSize} type="number" />
          </div>
        </SettingsSection>

        {/* Visibility & Access */}
        <SettingsSection title="Visibility & Access" icon={Globe}>
          <div className="space-y-5">
            <ToggleField
              label="Public listing"
              description="Show this hackathon on the public directory."
              checked={publicListing}
              onChange={setPublicListing}
            />
            <ToggleField
              label="Require approval"
              description="Manually approve team registrations."
              checked={requireApproval}
              onChange={setRequireApproval}
            />
            <ToggleField
              label="Allow late submissions"
              description="Accept submissions after the deadline."
              checked={allowLateSubmissions}
              onChange={setAllowLateSubmissions}
            />
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <motion.div variants={item} className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h3 className="text-sm font-bold text-red-400/80">Danger Zone</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Delete hackathon</p>
              <p className="text-[10px] text-white/25 mt-0.5">This action is irreversible. All data will be permanently deleted.</p>
            </div>
            <AnimatePresence mode="wait">
              {showDeleteConfirm ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="delete"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
