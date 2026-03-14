import { NextResponse } from 'next/server'
export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  return NextResponse.json({ 
    anthropic_key: hasKey ? '✅ configurata' : '❌ mancante',
    key_prefix: process.env.ANTHROPIC_API_KEY?.substring(0, 14) + '...' || 'NOT SET',
    ts: new Date().toISOString()
  })
}
