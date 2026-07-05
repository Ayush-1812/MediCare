import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { MessageRole } from '@prisma/client';
import { AIOrchestrator } from '@/lib/ai/AIOrchestrator';

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user
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

        // 2. Validate payload
        const body = await req.json();
        const { message, conversationId } = body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return NextResponse.json({ success: false, message: 'Message is required' }, { status: 400 });
        }

        // 3. Handle Conversation
        let currentConversationId = conversationId;

        if (currentConversationId) {
            // Validate conversation belongs to user
            const conversation = await prisma.conversation.findUnique({
                where: { id: currentConversationId }
            });

            if (!conversation) {
                return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
            }

            if (conversation.userId !== userId) {
                return NextResponse.json({ success: false, message: 'Unauthorized access to conversation' }, { status: 403 });
            }
        } else {
            // Create a new conversation
            const newConversation = await prisma.conversation.create({
                data: {
                    userId,
                    title: message.substring(0, 40) + '...', // Simple title from message
                }
            });
            currentConversationId = newConversation.id;
            console.log(`[API /chat] Created new conversation: ${currentConversationId}`);
        }

        // 4. Save User Message
        await prisma.message.create({
            data: {
                conversationId: currentConversationId,
                role: MessageRole.USER,
                content: message,
            }
        });
        
        console.log(`[API /chat] Stored user message in conversation ${currentConversationId}`);

        // Update lastMessageAt
        await prisma.conversation.update({
            where: { id: currentConversationId },
            data: { lastMessageAt: new Date() }
        });

        // 5. Generate Placeholder Response & Save AI Message
        // Invoke the AI Orchestrator instead of using a static string
        const orchestrator = new AIOrchestrator();
        const orchestratorResponse = await orchestrator.handleRequest(userId, message);

        await prisma.message.create({
            data: {
                conversationId: currentConversationId,
                role: MessageRole.ASSISTANT,
                content: orchestratorResponse,
                model: 'ai-orchestrator-mock'
            }
        });
        
        console.log(`[API /chat] Stored assistant orchestrated message in conversation ${currentConversationId}`);

        // 6. Return Streaming Response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // Split text into words to simulate streaming chunks
                const words = orchestratorResponse.split(' ');
                
                for (let i = 0; i < words.length; i++) {
                    const word = words[i] + (i < words.length - 1 ? ' ' : '');
                    // For typical LLM streaming, we use SSE (Server-Sent Events) format or raw text.
                    // Here we will use Vercel AI SDK format if possible, or just raw text string chunks.
                    // Since we don't have AI SDK connected yet, we'll stream standard raw text.
                    controller.enqueue(encoder.encode(word));
                    
                    // Artificial delay to simulate real streaming
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                console.log(`[API /chat] Stream completed for conversation ${currentConversationId}`);
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Conversation-Id': currentConversationId,
            }
        });

    } catch (error: any) {
        console.error('[API /chat] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
