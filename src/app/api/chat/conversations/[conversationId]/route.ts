import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    try {
        const conversationId = (await params).conversationId;
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

        const conversation = await prisma.conversation.findUnique({
            where: {
                id: conversationId,
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!conversation) {
            return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
        }

        if (conversation.userId !== userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized access to conversation' }, { status: 403 });
        }

        return NextResponse.json({ success: true, conversation });
    } catch (error: any) {
        console.error('[API /chat/conversations/:id]', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
