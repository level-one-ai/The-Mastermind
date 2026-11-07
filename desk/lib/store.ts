import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Lead, LeadFile, Niche } from './types';

/**
 * Where the desk keeps its data.
 * On Vercel: JSON files in the private The-Mastermind GitHub repo (library/...),
 * read and written through the GitHub contents API. The Mastermind skill writes the same files.
 * Locally with no GITHUB_TOKEN: the same folder on disk, one level up from /desk.
 */
const LEADS = 'library/desk/leads';
const NICHES = 'library/niches';
const EDITS = 'library/desk/edits/pending';

const token = () => process.env.GITHUB_TOKEN ?? '';
export const repo = () => process.env.GITHUB_REPO ?? 'level-one-ai/The-Mastermind';
const branch = () => process.env.GITHUB_BRANCH ?? 'main';
export const useGitHub = () => token().length > 0;
export const localRoot = () => path.resolve(process.cwd(), '..');

export class ConflictError extends Error {}

const headers = () => ({
  Authorization: `Bearer ${token()}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const contentsUrl = (rel: string) =>
  `https://api.github.com/repos/${repo()}/contents/${rel.split('/').map(encodeURIComponent).join('/')}`;

async function gh(rel: string, init: RequestInit = {}, query = `?ref=${branch()}`) {
  const res = await fetch(contentsUrl(rel) + query, {
    ...init,
    cache: 'no-store',
    headers: { ...headers(), ...(init.headers ?? {}) },
  });
  if (res.status === 409 || res.status === 422) throw new ConflictError(await res.text());
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string) => Buffer.from(s, 'base64').toString('utf8');

/** Every .json in a library folder, parsed. */
async function listJson<T>(dir: string): Promise<{ data: T; sha?: string; name: string }[]> {
  if (!useGitHub()) {
    const abs = path.join(localRoot(), dir);
    const names = (await fs.readdir(abs).catch(() => [] as string[])).filter((n) => n.endsWith('.json'));
    return Promise.all(names.map(async (name) => ({ name, data: JSON.parse(await fs.readFile(path.join(abs, name), 'utf8')) as T })));
  }
  let entries: { name: string }[] = [];
  try {
    entries = await gh(dir);
  } catch (e) {
    if (String(e).includes('404')) return [];
    throw e;
  }
  const files = entries.filter((e) => e.name.endsWith('.json'));
  return Promise.all(
    files.map(async (f) => {
      const file = await gh(`${dir}/${f.name}`);
      return { name: f.name, data: JSON.parse(unb64(file.content)) as T, sha: file.sha as string };
    }),
  );
}

export async function listLeads(): Promise<Lead[]> {
  return (await listJson<Lead>(LEADS)).map((f) => f.data);
}

export async function listNiches(): Promise<Niche[]> {
  return (await listJson<Niche>(NICHES)).map((f) => f.data).sort((a, b) => a.label.localeCompare(b.label));
}

export async function readLead(id: string): Promise<LeadFile> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Bad lead id');
  const rel = `${LEADS}/${id}.json`;
  if (!useGitHub()) return { lead: JSON.parse(await fs.readFile(path.join(localRoot(), rel), 'utf8')) };
  const file = await gh(rel);
  return { lead: JSON.parse(unb64(file.content)), sha: file.sha };
}

export async function writeLead(file: LeadFile, message: string) {
  const rel = `${LEADS}/${file.lead.id}.json`;
  const text = JSON.stringify(file.lead, null, 2) + '\n';
  if (!useGitHub()) {
    await fs.writeFile(path.join(localRoot(), rel), text, 'utf8');
    return;
  }
  await gh(rel, { method: 'PUT', body: JSON.stringify({ message, content: b64(text), sha: file.sha, branch: branch() }) }, '');
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
  await gh(rel, { method: 'PUT', body: JSON.stringify({ message: `desk: edit ${name}`, content: b64(text), branch: branch() }) }, '');
}

export const storageLabel = () => (useGitHub() ? `GitHub · ${repo()}` : 'Local files');
