import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateAdif, type AdifExportContact } from '@/lib/adif';
import { buildContactSearchQuery } from '@/lib/contact-search';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const isExport = searchParams.get('export') === 'true';

    const userId = typeof user.userId === 'string' ? parseInt(user.userId, 10) : user.userId;

    // Build the parameterized WHERE clause from the query-string filters. The
    // builder numbers placeholders off the params array so a predicate-only
    // filter (QSL status) can't shift a later value-bound filter (DXCC) onto a
    // nonexistent `$N` — the bug that used to 500 confirmed-status + DXCC searches.
    const { whereClause, params: queryParams } = buildContactSearchQuery(userId, {
      callsign: searchParams.get('callsign') || undefined,
      name: searchParams.get('name') || undefined,
      qth: searchParams.get('qth') || undefined,
      mode: searchParams.get('mode') || undefined,
      band: searchParams.get('band') || undefined,
      gridLocator: searchParams.get('gridLocator') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      qslStatus: searchParams.get('qslStatus') || undefined,
      dxcc: searchParams.get('dxcc') || undefined,
    });

    if (isExport) {
      // Export all matching contacts as ADIF
      const exportSql = `
        SELECT * FROM contacts 
        WHERE ${whereClause}
        ORDER BY datetime DESC
      `;

      const exportResult = await query(exportSql, queryParams);
      const contacts = exportResult.rows as AdifExportContact[];

      // Reuse the shared ADIF serializer used by the main export. The previous
      // hand-rolled generator here declared field lengths with JS String.length
      // (UTF-16 code units) instead of the UTF-8 byte count ADIF requires (the
      // bug fixed for the main export in #228), crashed with a 500 when a
      // contact had a null frequency/mode/band, and dropped most fields (DXCC,
      // QSL status, country, station info). generateAdif fixes all three.
      const adifContent = generateAdif(contacts);

      const filename = `nextlog-search-results-${new Date().toISOString().slice(0, 10)}.adi`;

      return new NextResponse(adifContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Regular search query with pagination
    const contactsSql = `
      SELECT * FROM contacts 
      WHERE ${whereClause}
      ORDER BY datetime DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const countSql = `
      SELECT COUNT(*) FROM contacts 
      WHERE ${whereClause}
    `;

    const [contactsResult, countResult] = await Promise.all([
      query(contactsSql, [...queryParams, limit, offset]),
      query(countSql, queryParams)
    ]);

    const contacts = contactsResult.rows;
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error searching contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}