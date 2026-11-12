import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;

/** Minimal in-memory stand-in for the parts of supabase-js that ingest uses. */
export class FakeDb {
  tables: Record<string, Row[]> = {};
  upserts: { table: string; rows: Row[]; onConflict?: string }[] = [];
  private nextId = 1;
  failTables = new Set<string>();

  rows(table: string): any {
    return (this.tables[table] ??= []);
  }

  client(): SupabaseClient {
    return { from: (t: string) => this.builder(t) } as unknown as SupabaseClient;
  }

  private builder(table: string) {
    const self = this;
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
    let payload: any;
    let opts: any;
    let filters: [string, unknown][] = [];
    let head = false;
    const matches = (r: Row) => filters.every(([k, v]) => r[k] === v);

    const exec = (mode: 'many' | 'single' | 'maybe') => {
      if (self.failTables.has(table)) return { data: null, error: { message: `${table} is down` } };
      const rows: Row[] = self.rows(table);
      if (op === 'insert') {
        const row = { id: self.nextId++, ...payload };
        rows.push(row);
        return { data: mode === 'many' ? [row] : row, error: null };
      }
      if (op === 'update') {
        rows.filter(matches).forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      if (op === 'upsert') {
        const list: Row[] = Array.isArray(payload) ? payload : [payload];
        self.upserts.push({ table, rows: list, onConflict: opts?.onConflict });
        const keys: string[] = (opts?.onConflict ?? 'id').split(',');
        for (const row of list) {
          const existing = rows.find((r) => keys.every((k) => r[k] === row[k]));
          if (existing) Object.assign(existing, row);
          else rows.push({ ...row });
        }
        return { data: null, error: null };
      }
      const found = rows.filter(matches);
      if (head) return { data: null, count: found.length, error: null };
      if (mode === 'maybe') return { data: found[0] ?? null, error: null };
      if (mode === 'single') return { data: found[0] ?? null, error: found[0] ? null : { message: 'no row' } };
      return { data: found, error: null };
    };

    const b: any = {
      select(_cols?: string, o?: { head?: boolean }) {
        if (op === 'select') head = !!o?.head;
        return b;
      },
      insert(p: any) { op = 'insert'; payload = p; return b; },
      update(p: any) { op = 'update'; payload = p; return b; },
      upsert(p: any, o?: any) { op = 'upsert'; payload = p; opts = o; return b; },
      eq(k: string, v: unknown) { filters.push([k, v]); return b; },
      single: () => Promise.resolve(exec('single')),
      maybeSingle: () => Promise.resolve(exec('maybe')),
      then: (res: any, rej: any) => Promise.resolve(exec('many')).then(res, rej),
    };
    return b;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function apiError(message: string, code = 100, status = 400): Response {
  return jsonResponse({ error: { message, code } }, status);
}
