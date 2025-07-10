import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// /api/templates  GET -> list, POST -> create

export async function GET() {
  try {
    const snap = await adminDb.collection('notification_templates').orderBy('createdAt','desc').get();
    const templates = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    return NextResponse.json({ templates });
  } catch(err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, body:msgBody, imageUrl, iconUrl, launchUrl, buttons, target, scheduleCron, active=true } = body;
    if(!title || !msgBody) return NextResponse.json({ error:'title and body required'},{status:400});
    const docRef = await adminDb.collection('notification_templates').add({
      title,
      body: msgBody,
      imageUrl: imageUrl||null,
      iconUrl: iconUrl||null,
      launchUrl: launchUrl||null,
      buttons: buttons||[],
      target: target||'all',
      scheduleCron: scheduleCron||null,
      active,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({ success:true, id: docRef.id });
  } catch(err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 