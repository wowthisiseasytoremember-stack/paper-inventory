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

    // Phase 6: Filtering
    const decision = searchParams.get('decision');
    const highValue = searchParams.get('high_value');
    const category = searchParams.get('category');

    let items;
    let total;

    // Dynamic WHERE clause
    const conditions: string[] = ['i.deletedAt IS NULL'];
    const params: (string | number)[] = [];

    if (decision) {
      conditions.push('i.purchase_decision = ?');
      params.push(decision);
    }
    if (highValue === '1') {
      conditions.push('i.is_high_value = 1');
    }
    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }

    if (s) {
      // FTS Search with filters
      const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
      const searchSql = `
        SELECT i.* 
        FROM items i
        JOIN items_fts fts ON fts.rowid = i.rowid
        WHERE items_fts MATCH ? 
          ${whereClause}
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;
      const safeQuery = `"${s.replace(/"/g, '""')}"*`; 

      items = db.prepare(searchSql).all(safeQuery, ...params, limit, offset);
      
      const countSql = `
        SELECT COUNT(*) as count 
        FROM items i
        JOIN items_fts fts ON fts.rowid = i.rowid
        WHERE items_fts MATCH ?
          ${whereClause}
      `;
      total = (db.prepare(countSql).get(safeQuery, ...params) as { count: number }).count;

    } else {
      // Standard Listing with filters
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT * FROM items i
        ${whereClause}
        ORDER BY createdAt DESC 
        LIMIT ? OFFSET ?
      `;
      items = db.prepare(sql).all(...params, limit, offset);

      const countSql = `SELECT COUNT(*) as count FROM items i ${whereClause}`;
      total = (db.prepare(countSql).get(...params) as { count: number }).count;
    }

    // Parse JSON fields
    items = items.map((item: any) => ({
      ...item,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      tags: item.tags ? JSON.parse(item.tags) : [],
      comp_search_keywords: item.comp_search_keywords ? JSON.parse(item.comp_search_keywords) : [],
      visible_flaws: item.visible_flaws ? JSON.parse(item.visible_flaws) : [],
      research_pathways: item.research_pathways ? JSON.parse(item.research_pathways) : [],
      uncertain_fields: item.uncertain_fields ? JSON.parse(item.uncertain_fields) : [],
      item_specifics: item.item_specifics ? JSON.parse(item.item_specifics) : {},
      identification: item.identification,
      estimated_value: item.estimated_value,
      liquidity_score: item.liquidity_score,
      target_buy_price: item.target_buy_price,
      user_decision: item.user_decision || 'none',
      processingLock: Boolean(item.processingLock)
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
