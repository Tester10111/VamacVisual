// API Proxy route to bypass CORS by forwarding requests to Google Apps Script
import { NextRequest, NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (!action) {
    return NextResponse.json({ error: 'Action parameter required' }, { status: 400 });
  }

  try {
    // Forward the request to Google Apps Script
    const response = await fetch(`${APPS_SCRIPT_URL}?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script request failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to Google Apps Script' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action parameter required' }, { status: 400 });
    }

    // Forward the request to Google Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action,
        ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script request failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to Google Apps Script' },
      { status: 500 }
    );
  }
}