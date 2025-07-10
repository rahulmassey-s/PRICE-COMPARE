// Industrial-grade OneSignal helper using official SDK
// Install once: `npm i @onesignal/node-onesignal`

import * as OneSignal from '@onesignal/node-onesignal';

export type PushSegments = 'Subscribed Users' | 'All' | string;

interface BasicPushPayload {
  headings: string;
  contents: string;
  segments?: PushSegments[]; // default → ['Subscribed Users']
}

export async function sendPush({ headings, contents, segments = ['Subscribed Users'] }: BasicPushPayload) {
  const { ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY } = process.env;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    throw new Error('OneSignal env vars missing');
  }

  // Build SDK client (SDK handles host, auth-scheme & headers internally)
  const configuration = OneSignal.createConfiguration({
    // According to SDK docs, REST API key should be passed as `restApiKey`
    restApiKey: ONESIGNAL_REST_API_KEY, // App REST API Key
  });

  const client = new OneSignal.DefaultApi(configuration as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notification: any = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: segments,
    headings: { en: headings },
    contents: { en: contents },
  };

  try {
    const apiResponse = await client.createNotification(notification);
    // Normalise SDK response
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseData = (apiResponse as any).body ?? apiResponse;
    return { status: 200, data: responseData } as const;
  } catch (err: any) {
    // SDK error – capture HTTP status and body if available
    if (err?.response) {
      const status = err.response.status as number;
      const data = err.body;

      // Fallback: Some accounts still require lowercase "key" header and classic REST endpoint.
      if (status >= 400 && status < 500) {
        const res = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(notification),
        });

        const fallbackData = await res.json();
        return { status: res.status, data: fallbackData } as const;
      }

      return { status, data } as const;
    }
    throw err;
  }
} 