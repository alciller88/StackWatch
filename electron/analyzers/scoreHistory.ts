import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScoreHistoryEntry } from '../../shared/types';

export type { ScoreHistoryEntry };

const HISTORY_DIR = '.stackwatch';
const HISTORY_FILE = 'score-history.json';
const MAX_ENTRIES = 100;

export async function loadScoreHistory(repoPath: string): Promise<ScoreHistoryEntry[]> {
  const filePath = path.join(repoPath, HISTORY_DIR, HISTORY_FILE);
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
  repoPath: string,
  entry: ScoreHistoryEntry
): Promise<void> {
  const dirPath = path.join(repoPath, HISTORY_DIR);
  const filePath = path.join(dirPath, HISTORY_FILE);

  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory might already exist
  }

  const history = await loadScoreHistory(repoPath);
  history.push(entry);

  // Keep only last MAX_ENTRIES
  const trimmed = history.slice(-MAX_ENTRIES);

  await fs.writeFile(filePath, JSON.stringify(trimmed, null, 2), 'utf-8');
}
