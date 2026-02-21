/**
 * Minimal SMTP client for Cloudflare Workers using TCP sockets.
 * Supports AUTH PLAIN over direct TLS (port 465) and STARTTLS (port 587).
 *
 * Usage:
 *   const config = parseSmtpUrl(smtpUrl);
 *   await sendSmtp(config, 'noreply@devsage.org', ['judge@example.com'], 'Subject', '<p>HTML</p>');
 */

declare module 'cloudflare:sockets' {
  interface SocketAddress {
    hostname: string;
    port: number;
  }
  interface SocketOptions {
    secureTransport?: 'off' | 'on' | 'starttls';
    allowHalfOpen?: boolean;
  }
  interface Socket {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    opened: Promise<{ remoteAddress?: string }>;
    closed: Promise<void>;
    close(): Promise<void>;
    startTls(): Socket;
  }
  export function connect(
    address: SocketAddress | string,
    options?: SocketOptions,
  ): Socket;
}

import { connect } from 'cloudflare:sockets';

const TIMEOUT_MS = 15_000;

// ── Line-oriented SMTP connection ──────────────────────────────────

class SmtpConnection {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = '';

  constructor(
    readable: ReadableStream<Uint8Array>,
    writable: WritableStream<Uint8Array>,
  ) {
    this.reader = readable.getReader();
    this.writer = writable.getWriter();
  }

  /** Read one CRLF-terminated line from the stream. */
  private async readLine(): Promise<string> {
    while (!this.buffer.includes('\r\n')) {
      const { value, done } = await this.reader.read();
      if (done) throw new Error('SMTP: connection closed unexpectedly');
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    const idx = this.buffer.indexOf('\r\n');
    const line = this.buffer.slice(0, idx);
    this.buffer = this.buffer.slice(idx + 2);
    return line;
  }

  /** Read a full multi-line SMTP response (NNN-... continuation, NNN SP final). */
  async readResponse(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      // Final line: "250 OK" (space after code), not "250-..." (dash = continuation)
      if (line.length >= 4 && line[3] === ' ') {
        return { code: parseInt(line.slice(0, 3)), text: lines.join('\n') };
      }
    }
  }

  /** Send an SMTP command and return the server response. */
  async command(cmd: string): Promise<{ code: number; text: string }> {
    await this.writer.write(this.encoder.encode(cmd + '\r\n'));
    return this.readResponse();
  }

  /** Write raw bytes without waiting for a response. */
  async writeRaw(data: string): Promise<void> {
    await this.writer.write(this.encoder.encode(data));
  }

  /** Release stream locks so the socket can be upgraded or closed. */
  release() {
    try {
      this.reader.releaseLock();
    } catch {
      /* already released */
    }
    try {
      this.writer.releaseLock();
    } catch {
      /* already released */
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────

/** RFC 5321 dot-stuffing: any body line starting with "." gets an extra ".". */
function dotStuff(body: string): string {
  return body
    .split('\r\n')
    .map((l) => (l.startsWith('.') ? '.' + l : l))
    .join('\r\n');
}

/** Build a minimal RFC 2822 message with HTML body. */
function buildMessage(
  from: string,
  to: string[],
  subject: string,
  html: string,
): string {
  const msgId = `<${crypto.randomUUID()}@devsage.org>`;
  return [
    `From: DevSage <${from}>`,
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    dotStuff(html),
  ].join('\r\n');
}

// ── Public API ─────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Parse an SMTP URL into host/port/username/password.
 *
 * Formats:
 *   smtp://user:pass@host:587   → STARTTLS
 *   smtps://user:pass@host:465  → direct TLS
 *
 * If port is omitted, defaults to 465 for smtps://, 587 for smtp://.
 */
export function parseSmtpUrl(url: string): SmtpConfig {
  const parsed = new URL(url);
  const secure = parsed.protocol === 'smtps:';
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : secure ? 465 : 587,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

/**
 * Send an email via SMTP using Cloudflare Workers TCP sockets.
 * Returns true on success, false on failure (fail-open, never throws).
 */
export async function sendSmtp(
  config: SmtpConfig,
  from: string,
  to: string[],
  subject: string,
  html: string,
): Promise<boolean> {
  const { host, port, username, password } = config;
  const directTls = port === 465;

  console.warn(`[smtp] Connecting to ${host}:${port} (${directTls ? 'direct TLS' : 'STARTTLS'}) as ${username}`);

  let socket = connect(
    { hostname: host, port },
    { secureTransport: directTls ? 'on' : 'starttls' },
  );

  let conn = new SmtpConnection(socket.readable, socket.writable);
  const timer = setTimeout(() => {
    try {
      socket.close();
    } catch {
      /* best-effort */
    }
  }, TIMEOUT_MS);

  try {
    // 1. Read server greeting
    const greeting = await conn.readResponse();
    console.warn(`[smtp] Greeting: ${greeting.code} ${greeting.text.slice(0, 80)}`);
    if (greeting.code !== 220)
      throw new Error(`Greeting: ${greeting.code} ${greeting.text}`);

    // 2. EHLO
    let ehlo = await conn.command('EHLO devsage.org');
    console.warn(`[smtp] EHLO: ${ehlo.code}`);
    if (ehlo.code !== 250) throw new Error(`EHLO: ${ehlo.code}`);

    // 3. STARTTLS upgrade for port 587
    if (!directTls) {
      const tls = await conn.command('STARTTLS');
      console.warn(`[smtp] STARTTLS: ${tls.code}`);
      if (tls.code !== 220) throw new Error(`STARTTLS: ${tls.code}`);
      conn.release();
      socket = socket.startTls();
      conn = new SmtpConnection(socket.readable, socket.writable);
      ehlo = await conn.command('EHLO devsage.org');
      console.warn(`[smtp] EHLO post-TLS: ${ehlo.code}`);
      if (ehlo.code !== 250) throw new Error(`EHLO post-TLS: ${ehlo.code}`);
    }

    // 4. AUTH PLAIN
    const creds = btoa(`\0${username}\0${password}`);
    const auth = await conn.command(`AUTH PLAIN ${creds}`);
    console.warn(`[smtp] AUTH: ${auth.code}`);
    if (auth.code !== 235)
      throw new Error(`AUTH: ${auth.code} ${auth.text}`);

    // 5. Envelope
    const mf = await conn.command(`MAIL FROM:<${from}>`);
    console.warn(`[smtp] MAIL FROM: ${mf.code}`);
    if (mf.code !== 250) throw new Error(`MAIL FROM: ${mf.code}`);

    for (const recipient of to) {
      const rc = await conn.command(`RCPT TO:<${recipient}>`);
      console.warn(`[smtp] RCPT TO <${recipient}>: ${rc.code}`);
      if (rc.code !== 250)
        throw new Error(`RCPT TO <${recipient}>: ${rc.code}`);
    }

    // 6. DATA
    const dataCmd = await conn.command('DATA');
    console.warn(`[smtp] DATA: ${dataCmd.code}`);
    if (dataCmd.code !== 354) throw new Error(`DATA: ${dataCmd.code}`);

    const message = buildMessage(from, to, subject, html);
    await conn.writeRaw(message + '\r\n.\r\n');

    const sent = await conn.readResponse();
    console.warn(`[smtp] DATA end: ${sent.code}`);
    if (sent.code !== 250)
      throw new Error(`DATA end: ${sent.code} ${sent.text}`);

    // 7. QUIT (best-effort)
    await conn.command('QUIT').catch(() => {});

    return true;
  } catch (err) {
    console.error(
      `SMTP send failed: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  } finally {
    clearTimeout(timer);
    conn.release();
    try {
      await socket.close();
    } catch {
      /* already closed */
    }
  }
}
