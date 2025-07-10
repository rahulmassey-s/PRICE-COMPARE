import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        const templateDoc = await firestore.collection('notification-templates').doc(id).get();
        
        if (!templateDoc.exists) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }
        
        return NextResponse.json({ id: templateDoc.id, ...templateDoc.data() });
    } catch (error: any) {
        console.error(`Error fetching template ${params.id}:`, error);
        return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }){
   try{
     const id = params.id;
     const body = await req.json();
     body.updatedAt = new Date();
     await firestore.collection('notification-templates').doc(id).set(body,{merge:true});
     return NextResponse.json({success:true});
   }catch(err:any){ return NextResponse.json({error:err.message},{status:500}); }
}
 
export async function DELETE(_req: Request, { params }: { params: { id: string } }){
   try{
     const id = params.id;
     await firestore.collection('notification-templates').doc(id).delete(); 
     return NextResponse.json({success:true});
   }
    catch(err:any){ return NextResponse.json({error:err.message},{status:500}); }
} 