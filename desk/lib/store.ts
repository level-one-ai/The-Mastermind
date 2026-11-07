import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Lead, LeadFile, Niche } from './types';

/**
 * Where the desk keeps its data: JSON files in the The-Mastermind GitHub repo (library/...).
 * The Mastermind skill writes the same files.
 *
 * - On Vercel the desk always reads GitHub, with or without a key. The repo's files are not part
 *   of the deployment, so there is no local copy to fall back to.
 * - Reads list a folder once, then fetch each file from raw.githubusercontent.com pinned to the
 *   current commit, so a page load costs a handful of GitHub API calls, not one per lead.
 * - If the key is missing or rejected, reads still work for a public repo and the page says
 *   saving is off. Nothing fails silently.
 * - Locally with no key: the same folder on disk, one level up from /desk.
 */
const LEADS = 'library/desk/leads';
const NICHES = 'library/niches';
const EDITS = 'library/desk/edits/pending';

const env = (k: string) => (process.env[k] ?? '').trim();
const token = () => env('GITHUB_TOKEN');

/** Accepts "owner/repo", "https://github.com/owner/repo(.git)" or "github.com/owner/repo". */
export const repo = () => {
  const raw = env('GITHUB_REPO') || 'level-one-ai/The-Mastermind';
  const m = raw.replace(/\.git$/i, '').replace(/\/+$/, '').match(/([\w.-]+)\/([\w.-]+)$/);
  return m ? `${m[1]}/${m[2]}` : raw;
};
const branch = () => env('GITHUB_BRANCH') || 'main';
export const useGitHub = () => token().length > 0 || !!process.env.VERCEL || env('DESK_SOURCE') === 'github';
export const localRoot = () => path.resolve(process.cwd(), '..');

export class ConflictError extends Error {}
export class DeskError extends Error {}

/** Set when the key was refused but the repo could still be read without it. */
let readOnlyReason: string | null = null;
export const readOnlyWarning = () => readOnlyReason;

const apiHeaders = (auth: boolean) => ({
  ...(auth && token() ? { Authorization: `Bearer ${token()}` } : {}),
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const enc = (rel: string) => rel.split('/').map(encodeURIComponent).join('/');

function explain(status: number, what: string): string {
  if (status === 401) return `GitHub refused the key (401, bad credentials). Make a new token and paste it into GITHUB_TOKEN in Vercel, then redeploy.`;
  if (status === 403) return `GitHub blocked the request (403). The key may not have access to ${repo()}, or the hourly limit was hit. Give the token Contents: Read and write on ${repo()}.`;
  if (status === 404)
    return `GitHub couldn't find ${what} in ${repo()} on branch "${branch()}" (404). Check GITHUB_REPO is level-one-ai/The-Mastermind and GITHUB_BRANCH is main, and that the token can see that repo.`;
  return `GitHub error ${status} while loading ${what}.`;
}

/** GET from the GitHub API. Tries with the key first; on 401/403 retries without it (works for a public repo). */
async function apiGet(url: string, what: string) {
  let res = await fetch(url, { cache: 'no-store', headers: apiHeaders(true) });
  if ((res.status === 401 || res.status === 403) && token()) {
    const reason = explain(res.status, what);
    const retry = await fetch(url, { cache: 'no-store', headers: apiHeaders(false) });
    if (retry.ok) {
      readOnlyReason = reason;
      return retry.json();
    }
    res = retry;
  }
  if (!res.ok) throw new DeskError(explain(res.status, what));
  return res.json();
}

/** The commit the branch points at right now, so every file in one page load comes from the same snapshot. */
async function headSha(): Promise<string> {
  const data = await apiGet(`https://api.github.com/repos/${repo()}/commits/${encodeURIComponent(branch())}`, `branch "${branch()}"`);
  return data.sha as string;
}

async function rawFile(sha: string, rel: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo()}/${sha}/${enc(rel)}`;
  let res = await fetch(url, { cache: 'no-store', headers: token() && !readOnlyReason ? { Authorization: `Bearer ${token()}` } : {} });
  if (!res.ok && token()) res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new DeskError(explain(res.status, rel));
  return res.text();
}

/** Every .json in a library folder, parsed. */
async function listJson<T>(dir: string, sha?: string): Promise<{ data: T; name: string }[]> {
  if (!useGitHub()) {
    const abs = path.join(localRoot(), dir);
    let names: string[];
    try {
      names = (await fs.readdir(abs)).filter((n) => n.endsWith('.json'));
    } catch {
      throw new DeskError(`Couldn't find the ${dir} folder next to the desk. Run the desk from inside the The-Mastermind repo, or set GITHUB_TOKEN.`);
    }
    return Promise.all(names.map(async (name) => ({ name, data: JSON.parse(await fs.readFile(path.join(abs, name), 'utf8')) as T })));
  }
  const ref = sha ?? (await headSha());
  const entries = (await apiGet(`https://api.github.com/repos/${repo()}/contents/${enc(dir)}?ref=${ref}`, `the ${dir} folder`)) as { name: string; type: string }[];
  const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.json'));
  return Promise.all(
    files.map(async (f) => {
      const text = await rawFile(ref, `${dir}/${f.name}`);
      try {
        return { name: f.name, data: JSON.parse(text) as T };
      } catch {
        throw new DeskError(`${dir}/${f.name} isn't valid JSON. Fix or remove that file in the repo.`);
      }
    }),
  );
}

export async function loadDesk(): Promise<{ leads: Lead[]; niches: Niche[]; warning: string | null }> {
  readOnlyReason = null;
  const sha = useGitHub() ? await headSha() : undefined;
  const [leads, niches] = await Promise.all([listJson<Lead>(LEADS, sha), listJson<Niche>(NICHES, sha)]);
  return {
    leads: leads.map((f) => f.data),
    niches: niches.map((f) => f.data).sort((a, b) => a.label.localeCompare(b.label)),
    warning: readOnlyReason ? `Saving is off: ${readOnlyReason}` : null,
  };
}

export async function listLeads(): Promise<Lead[]> {
  return (await listJson<Lead>(LEADS)).map((f) => f.data);
}

export async function listNiches(): Promise<Niche[]> {
  return (await listJson<Niche>(NICHES)).map((f) => f.data).sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- writes (need a working key) ----------

function needKey() {
  if (!token()) throw new DeskError('Saving needs a GitHub key. Add GITHUB_TOKEN in Vercel (Contents: Read and write on The-Mastermind), then redeploy.');
}

async function ghWrite(rel: string, body: unknown) {
  const res = await fetch(`https://api.github.com/repos/${repo()}/contents/${enc(rel)}`, {
    method: 'PUT',
    cache: 'no-store',
    headers: apiHeaders(true),
    body: JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) throw new ConflictError(await res.text());
  if (!res.ok) throw new DeskError(`Couldn't save. ${explain(res.status, rel)}`);
  return res.json();
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string) => Buffer.from(s, 'base64').toString('utf8');

export async function readLead(id: string): Promise<LeadFile> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Bad lead id');
  const rel = `${LEADS}/${id}.json`;
  if (!useGitHub()) return { lead: JSON.parse(await fs.readFile(path.join(localRoot(), rel), 'utf8')) };
  needKey();
  const file = await apiGet(`https://api.github.com/repos/${repo()}/contents/${enc(rel)}?ref=${encodeURIComponent(branch())}`, rel);
  return { lead: JSON.parse(unb64(file.content)), sha: file.sha };
}

export async function writeLead(file: LeadFile, message: string) {
  const rel = `${LEADS}/${file.lead.id}.json`;
  const text = JSON.stringify(file.lead, null, 2) + '\n';
  if (!useGitHub()) {
    await fs.writeFile(path.join(localRoot(), rel), text, 'utf8');
    return;
  }
  needKey();
  await ghWrite(rel, { message, content: b64(text), sha: file.sha, branch: branch() });
}

/** One file per saved edit. The Mastermind reads these on its next run and learns how Dean talks. */
export async function writeEdit(name: string, data: unknown) {
  const rel = `${EDITS}/${name}.json`;
  const text = JSON.stringify(data, null, 2) + '\n';
  if (!useGitHub()) {
    await fs.mkdir(path.join(localRoot(), EDITS), { recursive: true });
    await fs.writeFile(path.join(localRoot(), rel), text, 'utf8');
    return;
  }
  await ghWrite(rel, { message: `desk: edit ${name}`, content: b64(text), branch: branch() });
}

export const storageLabel = () => (useGitHub() ? `GitHub · ${repo()} · ${branch()}` : 'Local files');
