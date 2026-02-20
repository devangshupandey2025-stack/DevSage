import { describe, expect, it } from 'vitest';
import hackathonShell from '../routes/hackathon-shell.js';

interface ShellResponse {
  ok: boolean;
  data: {
    name: string;
    tagline: string;
    description: string;
    start_date: string;
    end_date: string;
    rules: string[];
    submission_instructions: {
      git_tag_workflow: string;
      example_command: string;
      docs_url: string;
      manual_upload_available: boolean;
    };
    is_stub_data: boolean;
  };
}

describe('GET /hackathon-shell', () => {
  it('returns 200 with stubbed hackathon data', async () => {
    const res = await hackathonShell.request('/hackathon-shell');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ShellResponse;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('DevSage Launch Hackathon');
    expect(body.data.is_stub_data).toBe(true);
  });

  it('includes submission instructions with git tag workflow', async () => {
    const res = await hackathonShell.request('/hackathon-shell');
    const body = (await res.json()) as ShellResponse;
    expect(body.data.submission_instructions.git_tag_workflow).toBeDefined();
    expect(body.data.submission_instructions.example_command).toContain('git tag');
    expect(body.data.submission_instructions.manual_upload_available).toBe(false);
  });

  it('returns non-empty rules array', async () => {
    const res = await hackathonShell.request('/hackathon-shell');
    const body = (await res.json()) as ShellResponse;
    expect(Array.isArray(body.data.rules)).toBe(true);
    expect(body.data.rules.length).toBeGreaterThan(0);
  });
});
