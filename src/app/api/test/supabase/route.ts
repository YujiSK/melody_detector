import { NextResponse } from 'next/server'

interface SchemaParameter {
  name: string
  in: string
}

export async function GET() {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!key) {
      return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
    }

    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    })
    
    const schema = await res.json()
    
    if (!schema.paths) {
      return NextResponse.json({ ok: false, error: 'Failed to retrieve schema paths', response: schema }, { status: 500 })
    }

    const songsGet = schema.paths['/songs']?.get
    const songsParams = (songsGet?.parameters || []) as SchemaParameter[]
    
    const columns = songsParams
      .filter((p) => p.in === 'query' && p.name && !p.name.includes('.'))
      .map((p) => p.name)

    return NextResponse.json({
      ok: true,
      tables: Object.keys(schema.paths).map(p => p.slice(1)),
      songs_columns: columns,
      songs_schema_raw: songsParams
    })

  } catch (e) {
    const error = e as Error
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
