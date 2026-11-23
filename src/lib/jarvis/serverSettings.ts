import { normalizeSettings, type Settings } from './settings';
import { getJson, setJson } from './store';

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await getJson('settings'));
}

export async function saveSettings(raw: unknown): Promise<Settings> {
  const s = normalizeSettings(raw);
  await setJson('settings', s);
  return s;
}
