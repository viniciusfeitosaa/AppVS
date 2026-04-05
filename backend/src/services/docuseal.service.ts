/**
 * Integração opcional com DocuSeal (cloud ou self-hosted).
 * Variáveis: DOCUSEAL_API_BASE_URL, DOCUSEAL_API_TOKEN, opcional DOCUSEAL_WEB_BASE_URL.
 */

const DOCUSEAL_DEFAULT_WEB = 'https://docuseal.com';

export function normalizarEmailDocuseal(email: string | null | undefined): string | null {
  const t = (email || '').trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function submitterPrecisaAssinar(status: string | undefined | null): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s !== 'completed' && s !== 'declined' && s !== 'expired';
}

function urlAssinaturaSubmitter(sub: Record<string, unknown>, webBase: string): string | null {
  const embed = typeof sub.embed_src === 'string' ? sub.embed_src.trim() : '';
  if (embed) return embed;
  const slug = typeof sub.slug === 'string' ? sub.slug.trim() : '';
  if (!slug) return null;
  const base = webBase.replace(/\/$/, '');
  return `${base}/s/${slug}`;
}

type Credenciais = { ok: false } | { ok: true; apiBase: string; token: string; webBase: string };

function credenciaisDocuseal(): Credenciais {
  const apiBase = process.env.DOCUSEAL_API_BASE_URL?.trim();
  const token = process.env.DOCUSEAL_API_TOKEN?.trim();
  const webBase = (process.env.DOCUSEAL_WEB_BASE_URL?.trim() || DOCUSEAL_DEFAULT_WEB).replace(/\/$/, '');
  if (!apiBase || !token) return { ok: false };
  return { ok: true, apiBase: apiBase.replace(/\/$/, ''), token, webBase };
}

async function fetchTodasSubmissionsPendentes(apiBase: string, token: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let after: number | undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  try {
    for (let page = 0; page < 15; page++) {
      const qs = new URLSearchParams({ status: 'pending', limit: '100' });
      if (after !== undefined) qs.set('after', String(after));

      const resp = await fetch(`${apiBase}/submissions?${qs}`, {
        method: 'GET',
        headers: { 'X-Auth-Token': token },
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`DocuSeal HTTP ${resp.status}${txt ? ` — ${txt.slice(0, 200)}` : ''}`);
      }

      const json = (await resp.json()) as { data?: unknown; pagination?: { next?: unknown } };
      const batch = Array.isArray(json.data) ? json.data : [];
      if (batch.length === 0) break;

      for (const row of batch) {
        if (row && typeof row === 'object') all.push(row as Record<string, unknown>);
      }

      const nextRaw = json.pagination?.next;
      const next = typeof nextRaw === 'number' ? nextRaw : Number(nextRaw);
      if (!Number.isFinite(next) || next === after) break;
      after = next;
    }
  } finally {
    clearTimeout(timer);
  }

  return all;
}

export type DocusealSubPendente = {
  submitterId: number | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
};

export type DocusealPendenteItem = {
  submissionId: number;
  submissionSlug: string | null;
  templateName: string | null;
  createdAt: string | null;
  submittersPendentes: DocusealSubPendente[];
};

function parseSubmissionRow(r: Record<string, unknown>, webBase: string, opts: { fallbackSemSubmitter: boolean }): DocusealPendenteItem | null {
  const idRaw = r.id;
  const submissionId = typeof idRaw === 'number' ? idRaw : Number(idRaw);
  if (!Number.isFinite(submissionId)) return null;

  const submissionSlug = typeof r.slug === 'string' ? r.slug : null;
  const createdAt = typeof r.created_at === 'string' ? r.created_at : null;
  const tpl = r.template && typeof r.template === 'object' ? (r.template as Record<string, unknown>) : null;
  const templateName = tpl && typeof tpl.name === 'string' ? tpl.name : null;

  const submittersRaw = Array.isArray(r.submitters) ? r.submitters : [];
  const submittersPendentes: DocusealSubPendente[] = submittersRaw
    .map((su) => {
      if (!su || typeof su !== 'object') return null;
      const s = su as Record<string, unknown>;
      const status = typeof s.status === 'string' ? s.status : null;
      if (!submitterPrecisaAssinar(status)) return null;
      const sidRaw = s.id;
      const submitterId =
        typeof sidRaw === 'number' ? sidRaw : Number.isFinite(Number(sidRaw)) ? Number(sidRaw) : null;
      return {
        submitterId: submitterId != null && Number.isFinite(submitterId) ? submitterId : null,
        name: typeof s.name === 'string' ? s.name : null,
        email: typeof s.email === 'string' ? s.email : null,
        status,
        signUrl: urlAssinaturaSubmitter(s, webBase),
      };
    })
    .filter((x): x is DocusealSubPendente => x != null);

  if (submittersPendentes.length === 0 && opts.fallbackSemSubmitter) {
    submittersPendentes.push({
      submitterId: null,
      name: null,
      email: null,
      status: typeof r.status === 'string' ? r.status : 'pending',
      signUrl: null,
    });
  }

  if (submittersPendentes.length === 0) return null;

  return {
    submissionId,
    submissionSlug,
    templateName,
    createdAt,
    submittersPendentes,
  };
}

export type DocusealPendenteResultado = {
  configured: boolean;
  error: string | null;
  items: DocusealPendenteItem[];
};

export async function listDocusealPendentesAssinaturaService(): Promise<DocusealPendenteResultado> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    return { configured: false, error: null, items: [] };
  }

  try {
    const raw = await fetchTodasSubmissionsPendentes(c.apiBase, c.token);
    const items: DocusealPendenteItem[] = [];
    for (const row of raw) {
      const parsed = parseSubmissionRow(row, c.webBase, { fallbackSemSubmitter: true });
      if (parsed) items.push(parsed);
    }
    return { configured: true, error: null, items };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : e?.message || 'Falha na ligação ao DocuSeal.';
    return { configured: true, error: String(msg), items: [] };
  }
}

export type DocusealDocPendenteProf = {
  submitterId: number;
  submissionId: number;
  templateName: string | null;
  createdAt: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  signUrl: string | null;
};

export type DocusealResumoPorEmailsResultado = {
  configured: boolean;
  error: string | null;
  byEmail: Record<string, DocusealDocPendenteProf[]>;
};

/** Agrupa documentos pendentes no DocuSeal pelos e-mails dos profissionais desta página. */
export async function docusealResumoPorEmailsService(emails: string[]): Promise<DocusealResumoPorEmailsResultado> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    return { configured: false, error: null, byEmail: {} };
  }

  const normSet = new Set<string>();
  for (const e of emails) {
    const n = normalizarEmailDocuseal(e);
    if (n) normSet.add(n);
  }

  const byEmail: Record<string, DocusealDocPendenteProf[]> = {};
  for (const n of normSet) byEmail[n] = [];

  try {
    const raw = await fetchTodasSubmissionsPendentes(c.apiBase, c.token);

    for (const row of raw) {
      const parsed = parseSubmissionRow(row, c.webBase, { fallbackSemSubmitter: false });
      if (!parsed) continue;

      for (const sub of parsed.submittersPendentes) {
        const em = normalizarEmailDocuseal(sub.email);
        if (!em || !normSet.has(em) || sub.submitterId == null) continue;
        byEmail[em].push({
          submitterId: sub.submitterId,
          submissionId: parsed.submissionId,
          templateName: parsed.templateName,
          createdAt: parsed.createdAt,
          name: sub.name,
          email: sub.email,
          status: sub.status,
          signUrl: sub.signUrl,
        });
      }
    }

    return { configured: true, error: null, byEmail };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Tempo esgotado ao contactar DocuSeal.' : e?.message || 'Falha na ligação ao DocuSeal.';
    return { configured: true, error: String(msg), byEmail: {} };
  }
}

export async function docusealResendEmailSubmitterService(submitterId: number): Promise<void> {
  const c = credenciaisDocuseal();
  if (!c.ok) {
    throw { statusCode: 503, message: 'DocuSeal não está configurado no servidor.' };
  }
  if (!Number.isFinite(submitterId) || submitterId <= 0) {
    throw { statusCode: 400, message: 'submitterId inválido' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(`${c.apiBase}/submitters/${submitterId}`, {
      method: 'PUT',
      headers: {
        'X-Auth-Token': c.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ send_email: true }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw {
        statusCode: resp.status >= 400 && resp.status < 600 ? resp.status : 502,
        message: `DocuSeal: ${resp.status}${txt ? ` — ${txt.slice(0, 200)}` : ''}`,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}
