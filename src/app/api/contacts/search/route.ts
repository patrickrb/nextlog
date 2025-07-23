import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

interface SearchFilters {
  callsign?: string;
  name?: string;
  qth?: string;
  mode?: string;
  band?: string;
  gridLocator?: string;
  startDate?: string;
  endDate?: string;
  qslStatus?: string;
  dxcc?: string;
}

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

    // Extract search filters
    const filters: SearchFilters = {
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
    };

    // Build the WHERE clause and parameters
    const whereConditions: string[] = ['user_id = $1'];
    const queryParams: (string | number)[] = [userId];
    let paramCount = 1;

    // Add search conditions
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() !== '' && value !== 'all') {
        paramCount++;
        switch (key) {
          case 'callsign':
            whereConditions.push(`UPPER(callsign) LIKE UPPER($${paramCount})`);
            queryParams.push(`%${value}%`);
            break;
          case 'name':
            whereConditions.push(`UPPER(name) LIKE UPPER($${paramCount})`);
            queryParams.push(`%${value}%`);
            break;
          case 'qth':
            whereConditions.push(`UPPER(qth) LIKE UPPER($${paramCount})`);
            queryParams.push(`%${value}%`);
            break;
          case 'mode':
            whereConditions.push(`UPPER(mode) = UPPER($${paramCount})`);
            queryParams.push(value);
            break;
          case 'band':
            whereConditions.push(`UPPER(band) = UPPER($${paramCount})`);
            queryParams.push(value);
            break;
          case 'gridLocator':
            whereConditions.push(`UPPER(grid_locator) LIKE UPPER($${paramCount})`);
            queryParams.push(`%${value}%`);
            break;
          case 'startDate':
            whereConditions.push(`DATE(datetime) >= $${paramCount}`);
            queryParams.push(value);
            break;
          case 'endDate':
            whereConditions.push(`DATE(datetime) <= $${paramCount}`);
            queryParams.push(value);
            break;
          case 'qslStatus':
            // For now, we'll implement basic QSL status filtering
            // This can be expanded when QSL fields are added to the schema
            if (value === 'confirmed') {
              whereConditions.push(`confirmed = true`);
            } else if (value === 'not_confirmed') {
              whereConditions.push(`(confirmed = false OR confirmed IS NULL)`);
            }
            break;
          case 'dxcc':
            whereConditions.push(`dxcc = $${paramCount}`);
            queryParams.push(parseInt(value));
            break;
        }
      }
    });

    const whereClause = whereConditions.join(' AND ');

    if (isExport) {
      // Export all matching contacts as ADIF
      const exportSql = `
        SELECT * FROM contacts 
        WHERE ${whereClause}
        ORDER BY datetime DESC
      `;

      const exportResult = await query(exportSql, queryParams);
      const contacts = exportResult.rows;

      // Generate ADIF content
      let adifContent = 'ADIF Export from Nextlog\n';
      adifContent += `Generated on ${new Date().toISOString()}\n`;
      adifContent += '<EOH>\n\n';

      contacts.forEach((contact: {
        callsign: string;
        datetime: string;
        frequency: number;
        mode: string;
        band: string;
        rst_sent?: string;
        rst_received?: string;
        name?: string;
        qth?: string;
        grid_locator?: string;
        notes?: string;
      }) => {
        adifContent += `<CALL:${contact.callsign.length}>${contact.callsign}`;
        adifContent += `<QSO_DATE:8>${new Date(contact.datetime).toISOString().slice(0, 10).replace(/-/g, '')}`;
        adifContent += `<TIME_ON:6>${new Date(contact.datetime).toISOString().slice(11, 16).replace(':', '')}00`;
        adifContent += `<FREQ:${contact.frequency.toString().length}>${contact.frequency}`;
        adifContent += `<MODE:${contact.mode.length}>${contact.mode}`;
        adifContent += `<BAND:${contact.band.length}>${contact.band}`;
        
        if (contact.rst_sent) {
          adifContent += `<RST_SENT:${contact.rst_sent.length}>${contact.rst_sent}`;
        }
        if (contact.rst_received) {
          adifContent += `<RST_RCVD:${contact.rst_received.length}>${contact.rst_received}`;
        }
        if (contact.name) {
          adifContent += `<NAME:${contact.name.length}>${contact.name}`;
        }
        if (contact.qth) {
          adifContent += `<QTH:${contact.qth.length}>${contact.qth}`;
        }
        if (contact.grid_locator) {
          adifContent += `<GRIDSQUARE:${contact.grid_locator.length}>${contact.grid_locator}`;
        }
        if (contact.notes) {
          adifContent += `<NOTES:${contact.notes.length}>${contact.notes}`;
        }
        
        adifContent += '<EOR>\n';
      });

      const filename = `nextlog-search-results-${new Date().toISOString().slice(0, 10)}.adi`;
      
      return new NextResponse(adifContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
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