/**
 * LIST ITEMS API
 * 
 * Handles listing items with:
 * 1. Pagination (limit/offset)
 * 2. Full-Text Search (FTS5)
 * 3. Sorting (by createdAt desc)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const s = searchParams.get('q') || '';
    const offset = (page - 1) * limit;

    let items;
    let total;

    if (s) {
      // FTS Search
      // Uses the 'item_fts' virtual table configured in schema.sql
      // We join back to the main 'items' table for full data
      const searchSql = `
        SELECT i.* 
        FROM items i
        JOIN item_fts fts ON fts.rowid = i.rowid
        WHERE item_fts MATCH ? 
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;
      // FTS syntax: wrap in quotes for phrase search usually, or just pass clean string
      // Sanitization: Escape double quotes to prevent syntax errors in FTS queries
      const safeQuery = `"${s.replace(/"/g, '""')}"*`; 

      items = db.prepare(searchSql).all(safeQuery, limit, offset);
      
      const countSql = `
        SELECT COUNT(*) as count 
        FROM item_fts 
        WHERE item_fts MATCH ?
      `;
      total = (db.prepare(countSql).get(safeQuery) as { count: number }).count;

    } else {
      // Standard Listing
      items = db.prepare(`
        SELECT * FROM items 
        ORDER BY createdAt DESC 
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      total = (db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number }).count;
    }

    // Parse JSON fields
    items = items.map((item: any) => ({
      ...item,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      processingLock: Boolean(item.processingLock) // boolean for client
    }));

    return NextResponse.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('List Items Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
