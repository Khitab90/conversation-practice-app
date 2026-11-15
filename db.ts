import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('rep.db');

db.execSync(`CREATE TABLE IF NOT EXISTS reps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  mission TEXT NOT NULL,
  p_awk INTEGER NOT NULL, p_like INTEGER NOT NULL, p_rej INTEGER NOT NULL,
  a_awk INTEGER, a_like INTEGER, a_rej INTEGER,
  surprise TEXT
)`);

export type Ratings = { awk: number; like: number; rej: number };
export type OpenRep = { id: number; mission: string };
export type Gap = { n: number; p_awk: number; a_awk: number; p_like: number; a_like: number; p_rej: number; a_rej: number };

export function savePrediction(mission: string, p: Ratings) {
  db.runSync('INSERT INTO reps (mission, p_awk, p_like, p_rej) VALUES (?, ?, ?, ?)', mission, p.awk, p.like, p.rej);
}

export function saveOutcome(id: number, a: Ratings, surprise: string) {
  db.runSync('UPDATE reps SET a_awk = ?, a_like = ?, a_rej = ?, surprise = ? WHERE id = ?', a.awk, a.like, a.rej, surprise, id);
}

// The oldest rep that has a prediction but no outcome yet.
export function openRep(): OpenRep | null {
  return db.getFirstSync<OpenRep>('SELECT id, mission FROM reps WHERE a_awk IS NULL ORDER BY id LIMIT 1');
}

export function gap(): Gap {
  return db.getFirstSync<Gap>(`SELECT COUNT(*) AS n,
    AVG(p_awk) AS p_awk, AVG(a_awk) AS a_awk,
    AVG(p_like) AS p_like, AVG(a_like) AS a_like,
    AVG(p_rej) AS p_rej, AVG(a_rej) AS a_rej
    FROM reps WHERE a_awk IS NOT NULL`)!;
}
