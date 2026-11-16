import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('rep.db');

db.execSync(`CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL,
  goal_met INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

export function saveRound(ref: string, goalMet: boolean) {
  db.runSync('INSERT INTO rounds (ref, goal_met) VALUES (?, ?)', ref, goalMet ? 1 : 0);
}

export type Progress = { met: Record<string, number>; total: Record<string, number> };

export function loadProgress(): Progress {
  const rows = db.getAllSync<{ ref: string; met: number; total: number }>('SELECT ref, SUM(goal_met) AS met, COUNT(*) AS total FROM rounds GROUP BY ref');
  return {
    met: Object.fromEntries(rows.map((r) => [r.ref, r.met])),
    total: Object.fromEntries(rows.map((r) => [r.ref, r.total])),
  };
}
