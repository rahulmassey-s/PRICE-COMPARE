import { NextResponse } from 'next/server';

export async function GET() {
  // Basic sanity check for required env vars
  const { ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY } = process.env;
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return NextResponse.json(
      { error: 'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing in env' },
      { status: 500 },
    );
  }

  const body = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ['Subscribed Users'],
    headings: { en: 'OneSignal Test (GET)' },
    contents: { en: 'If you received this, credentials work!' },
  };

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, data });
} 