import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScoreHistoryEntry } from '../../shared/types';

export type { ScoreHistoryEntry };

const HISTORY_FILE = 'score-history.json';
const MAX_ENTRIES = 100;

export async function loadScoreHistory(dataDir: string): Promise<ScoreHistoryEntry[]> {
  const filePath = path.join(dataDir, HISTORY_FILE);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

export async function appendScoreEntry(
  dataDir: string,
  entry: ScoreHistoryEntry
): Promise<void> {
  const filePath = path.join(dataDir, HISTORY_FILE);

  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  const history = await loadScoreHistory(dataDir);
  history.push(entry);

  // Keep only last MAX_ENTRIES
  const trimmed = history.slice(-MAX_ENTRIES);

  await fs.writeFile(filePath, JSON.stringify(trimmed, null, 2), 'utf-8');
}
