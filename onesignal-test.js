// Using require for .env in a simple Node script
require('dotenv').config({ path: './.env.local' });

async function testOneSignal() {
    console.log('--- Running Isolated OneSignal Test ---');
    
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    // This is the user ID from the admin panel logs
    const TEST_EXTERNAL_USER_ID = '0grmQ6090zStYCfbZ3isyz1cVe2'; 

    console.log('Using App ID:', ONESIGNAL_APP_ID ? 'Loaded' : 'NOT FOUND');
    // We only log the last 4 characters for security
    console.log('Using REST API Key (last 4 chars):', ONESIGNAL_REST_API_KEY ? `...${ONESIGNAL_REST_API_KEY.slice(-4)}` : 'NOT FOUND');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.error('Error: Environment variables ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not found in .env.local');
        return;
    }

    const notificationPayload = {
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [TEST_EXTERNAL_USER_ID],
        channel_for_external_user_ids: "push",
        headings: { en: "Isolated Test" },
        contents: { en: "This is a test notification from an isolated script." },
    };

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(notificationPayload)
        });

        const data = await response.json();

        console.log('\\n--- OneSignal API Response ---');
        console.log('Status Code:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\\nSUCCESS: The notification was sent successfully (according to the API).');
            console.log('This means the issue is likely within the Next.js environment.');
        } else {
            console.log('\\nFAILURE: The API returned an error.');
            console.log('This confirms the issue is with the API call itself (likely the key or app ID), not the Next.js application.');
        }

    } catch (error) {
        console.error('\\n--- SCRIPT ERROR ---');
        console.error('An error occurred while running the test script:', error);
    }
}

testOneSignal(); 