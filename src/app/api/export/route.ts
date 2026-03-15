import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'csv'; // 'csv' | 'json'
    const decision = url.searchParams.get('decision');

    let query = `SELECT id, title, category, estimated_value_point, estimated_value_low, estimated_value_high,
      value_confidence, is_high_value, ebay_keywords, purchase_decision, research_location,
      asking_price, research_notes, historicalContext, collectorSignificance, tags, createdAt
      FROM items WHERE deletedAt IS NULL AND status = 'complete'`;
    const params: string[] = [];
    if (decision) { 
      query += ' AND purchase_decision = ?'; 
      params.push(decision); 
    }
    query += ' ORDER BY createdAt DESC';

    const items = db.prepare(query).all(...params) as Record<string, unknown>[];

    if (format === 'json') {
      return new NextResponse(JSON.stringify(items, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="research-export-${Date.now()}.json"`,
        },
      });
    }

    // CSV
    const headers = ['title','category','estimated_value','value_range','confidence','high_value',
      'ebay_keywords','decision','location','asking_price','notes','historical_context','created'];
    const rows = items.map(i => [
      i.title, i.category,
      i.estimated_value_point ?? '',
      i.estimated_value_low && i.estimated_value_high ? `${i.estimated_value_low}-${i.estimated_value_high}` : '',
      i.value_confidence, i.is_high_value ? 'YES' : '',
      i.ebay_keywords, i.purchase_decision,
      i.research_location, i.asking_price, i.research_notes,
      (i.historicalContext || '').toString().replace(/
/g, ' '),
      i.createdAt,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('
');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="research-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Export API] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
