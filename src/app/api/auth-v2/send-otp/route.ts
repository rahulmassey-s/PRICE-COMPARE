import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { mobile } = await request.json();

    if (!mobile) {
        return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const twoFactorApiKey = process.env.TWO_FACTOR_API_KEY;

    if (!twoFactorApiKey) {
        return NextResponse.json({ error: 'Server configuration error: 2Factor API Key is missing.' }, { status: 500 });
    }

    const url = `https://2factor.in/API/V1/${twoFactorApiKey}/SMS/+91${mobile}/AUTOGEN`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.Status !== 'Success') {
            console.error('2Factor API Error:', data);
            return NextResponse.json({ error: 'Failed to send OTP.', details: data.Details }, { status: 500 });
        }

        return NextResponse.json({ success: true, details: data.Details }); // 'details' is the session ID

    } catch (error: any) {
        console.error('Error calling 2Factor API:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
} 