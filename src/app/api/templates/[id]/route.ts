import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(_req:NextRequest,{ params }: { params:{ id:string }}) {
  try{ const doc=await adminDb.collection('notification_templates').doc(params.id).get(); if(!doc.exists) return NextResponse.json({error:'not found'},{status:404});
    return NextResponse.json({ id:doc.id, ...doc.data() });
  }catch(err:any){ return NextResponse.json({error:err.message},{status:500}); }
}

export async function PUT(req:NextRequest,{ params }:{params:{id:string}}){
  try{ const body=await req.json(); body.updatedAt=new Date(); await adminDb.collection('notification_templates').doc(params.id).set(body,{merge:true});
    return NextResponse.json({success:true});
  }catch(err:any){ return NextResponse.json({error:err.message},{status:500}); }
}

export async function DELETE(_req:NextRequest,{ params }:{params:{id:string}}){
  try{ await adminDb.collection('notification_templates').doc(params.id).delete(); return NextResponse.json({success:true});}
  catch(err:any){ return NextResponse.json({error:err.message},{status:500}); }
} 