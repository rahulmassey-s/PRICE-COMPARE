import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';

export async function GET() {
    try {
        const templatesSnapshot = await firestore.collection('notification-templates').get();
        const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(templates);
    } catch (error: any) {
        console.error("Error fetching templates:", error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
} 