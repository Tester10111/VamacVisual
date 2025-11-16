// API Proxy route to bypass CORS by forwarding requests to Google Apps Script
import { NextRequest, NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  console.log('🔍 API Proxy GET request received:', { action, url: request.url });
  console.log('📋 Using APPS_SCRIPT_URL:', APPS_SCRIPT_URL ? 'Set' : 'NOT SET');
  
  if (!action) {
    console.log('❌ No action parameter provided');
    return NextResponse.json({ error: 'Action parameter required' }, { status: 400 });
  }

  if (!APPS_SCRIPT_URL) {
    console.log('❌ APPS_SCRIPT_URL environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error: Google Apps Script URL not configured' }, { status: 500 });
  }

  try {
    console.log('🔄 Forwarding request to Google Apps Script...');
    // Forward the request to Google Apps Script
    const response = await fetch(`${APPS_SCRIPT_URL}?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Google Apps Script response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Google Apps Script request failed:', response.status, errorText);
      throw new Error(`Google Apps Script request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Successfully received data from Google Apps Script');
    return NextResponse.json(data);
  } catch (error) {
    console.error('💥 Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Proxy request failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log('🔍 API Proxy POST request received:', { action, params });

    if (!action) {
      console.log('❌ No action parameter provided');
      return NextResponse.json({ error: 'Action parameter required' }, { status: 400 });
    }

    if (!APPS_SCRIPT_URL) {
      console.log('❌ APPS_SCRIPT_URL environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error: Google Apps Script URL not configured' }, { status: 500 });
    }

    console.log('🔄 Forwarding POST request to Google Apps Script...');
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

    console.log('📡 Google Apps Script POST response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Google Apps Script POST request failed:', response.status, errorText);
      throw new Error(`Google Apps Script request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Successfully received POST data from Google Apps Script');
    return NextResponse.json(data);
  } catch (error) {
    console.error('💥 Proxy POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Proxy POST request failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}