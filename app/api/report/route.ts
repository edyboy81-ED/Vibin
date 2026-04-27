import { NextRequest, NextResponse } from 'next/server'
import { buildReport, generateEmailBody } from '@/lib/reportBuilder'

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  const reportDate = dateParam ? new Date(dateParam) : new Date()
  const data = await buildReport(reportDate)
  return NextResponse.json({
    ...data,
    reportDate: data.reportDate.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const { date } = await req.json()
  const reportDate = date ? new Date(date) : new Date()
  const data = await buildReport(reportDate)
  const emailBody = generateEmailBody(data)
  return NextResponse.json({ emailBody })
}
