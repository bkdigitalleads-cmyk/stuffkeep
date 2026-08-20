import * as SQLite from 'expo-sqlite';

export interface Room {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  name: string;
  roomId: number | null;
  roomName: string | null;
  valueCents: number;
  serial: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  photoCount: number;
  coverPath: string | null; // first photo, for list thumbnails
}

export interface Photo {
  id: number;
  itemId: number;
  path: string; // filename inside the app photos directory
  createdAt: number;
}

export const DEFAULT_ROOMS = [
  'Living Room',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Office',
  'Garage',
  'Storage',
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('stuffkeep.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
          value_cents INTEGER NOT NULL DEFAULT 0,
          serial TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          path TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_items_room ON items(room_id);
        CREATE INDEX IF NOT EXISTS idx_photos_item ON photos(item_id);
      `);
      const row = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM rooms');
      if ((row?.n ?? 0) === 0) {
        for (const name of DEFAULT_ROOMS) {
          await db.runAsync('INSERT OR IGNORE INTO rooms (name) VALUES (?)', [name]);
        }
      }
      return db;
    })();
  }
  return dbPromise;
}

const ITEM_SELECT = `
  SELECT i.*, r.name AS room_name,
    (SELECT COUNT(*) FROM photos p WHERE p.item_id = i.id) AS photo_count,
    (SELECT p.path FROM photos p WHERE p.item_id = i.id ORDER BY p.id ASC LIMIT 1) AS cover_path
  FROM items i LEFT JOIN rooms r ON r.id = i.room_id
`;

function rowToItem(row: any): Item {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id ?? null,
    roomName: row.room_name ?? null,
    valueCents: row.value_cents,
    serial: row.serial,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount: row.photo_count ?? 0,
    coverPath: row.cover_path ?? null,
  };
}

// ---------- rooms ----------

export async function getRooms(): Promise<Room[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM rooms ORDER BY name COLLATE NOCASE');
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function addRoom(name: string): Promise<Room | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO rooms (name) VALUES (?)', [trimmed]);
  const row = await db.getFirstAsync<any>('SELECT * FROM rooms WHERE name = ?', [trimmed]);
  return row ? { id: row.id, name: row.name } : null;
}

// ---------- items ----------

export interface ItemInput {
  name: string;
  roomId: number | null;
  valueCents: number;
  serial: string;
  notes: string;
}

export async function insertItem(input: ItemInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO items (name, room_id, value_cents, serial, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.name.trim(), input.roomId, input.valueCents, input.serial.trim(), input.notes.trim(), now, now]
  );
  return res.lastInsertRowId;
}

export async function updateItem(id: number, input: ItemInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE items SET name = ?, room_id = ?, value_cents = ?, serial = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [input.name.trim(), input.roomId, input.valueCents, input.serial.trim(), input.notes.trim(), Date.now(), id]
  );
}

/** Returns paths of this item's photos so the caller can delete the files. */
export async function deleteItem(id: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT path FROM photos WHERE item_id = ?', [id]);
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  return rows.map((r) => r.path);
}

export async function getItem(id: number): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`${ITEM_SELECT} WHERE i.id = ?`, [id]);
  return row ? rowToItem(row) : null;
}

export async function getItems(opts?: { roomId?: number | null; query?: string }): Promise<Item[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts && opts.roomId !== undefined) {
    if (opts.roomId === null) {
      where.push('i.room_id IS NULL');
    } else {
      where.push('i.room_id = ?');
      params.push(opts.roomId);
    }
  }
  if (opts?.query) {
    const escaped = opts.query.replace(/([%_\\])/g, '\\$1');
    where.push(`(i.name LIKE ? ESCAPE '\\' OR i.serial LIKE ? ESCAPE '\\' OR i.notes LIKE ? ESCAPE '\\')`);
    const like = `%${escaped}%`;
    params.push(like, like, like);
  }
  const sql = `${ITEM_SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY i.updated_at DESC LIMIT 1000`;
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(rowToItem);
}

export async function countItems(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM items');
  return row?.n ?? 0;
}

export interface Totals {
  itemCount: number;
  totalCents: number;
  roomsUsed: number;
  photoCount: number;
}

export async function getTotals(): Promise<Totals> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(value_cents), 0) AS total,
       COUNT(DISTINCT room_id) AS rooms
     FROM items`
  );
  const p = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM photos');
  return {
    itemCount: row?.n ?? 0,
    totalCents: row?.total ?? 0,
    roomsUsed: row?.rooms ?? 0,
    photoCount: p?.n ?? 0,
  };
}

// ---------- photos ----------

export async function addPhoto(itemId: number, path: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO photos (item_id, path, created_at) VALUES (?, ?, ?)', [
    itemId,
    path,
    Date.now(),
  ]);
}

export async function getPhotos(itemId: number): Promise<Photo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM photos WHERE item_id = ? ORDER BY id ASC',
    [itemId]
  );
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, path: r.path, createdAt: r.created_at }));
}

export async function deletePhoto(id: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT path FROM photos WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
  return row?.path ?? null;
}

/** All items with their photos, grouped for the report. */
export async function getItemsGroupedByRoom(): Promise<{ room: string; items: Item[] }[]> {
  const items = await getItems();
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.roomName ?? 'Unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([room, list]) => ({ room, items: list }));
}

export async function deleteAllData(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT path FROM photos');
  await db.execAsync('DELETE FROM photos; DELETE FROM items;');
  return rows.map((r) => r.path);
}

/** CSV export (RFC-4180): room,name,value,serial,notes,photos,added */
export async function exportCsv(): Promise<string> {
  const items = await getItems();
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const lines = ['room,item,value_usd,serial,notes,photo_count,added'];
  for (const it of [...items].reverse()) {
    lines.push(
      [
        q(it.roomName ?? ''),
        q(it.name),
        (it.valueCents / 100).toFixed(2),
        q(it.serial),
        q(it.notes),
        String(it.photoCount),
        new Date(it.createdAt).toISOString().slice(0, 10),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}
