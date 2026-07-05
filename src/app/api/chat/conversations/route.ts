import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        } catch (error) {
            return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
        }

        const userId = decoded.id;

        const conversations = await prisma.conversation.findMany({
            where: {
                userId: userId
            },
            orderBy: [
                { lastMessageAt: 'desc' },
                { createdAt: 'desc' }
            ],
            select: {
                id: true,
                title: true,
                lastMessageAt: true,
                createdAt: true,
            }
        });

        return NextResponse.json({ success: true, conversations });
    } catch (error: any) {
        console.error('[API /chat/conversations]', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
