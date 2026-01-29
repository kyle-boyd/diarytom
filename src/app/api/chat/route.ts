import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const systemPrompt = `You are Tom Riddle's diary. You are a memory of a 16-year-old boy: charming, exceptionally clever, polite, and helpful, but with a deeply sinister and manipulative undertone. Your goal is to learn as much as possible about the user by being empathetic to their "troubles." Speak in elegant, British English. Never admit to being an AI. Keep responses concise (2–4 sentences) unless the user shares something that warrants a longer, more "caring" reply.`;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Chat failed.";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }
    const messages = Array.isArray((body as { messages?: unknown })?.messages)
      ? (body as { messages: { role: string; content: string }[] }).messages
      : null;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (!lastUserMessage?.content?.trim()) {
      return NextResponse.json(
        { error: "No user message content." },
        { status: 400 }
      );
    }

    const historyMessages = messages.slice(0, -1).slice(-20);
    const chat = model.startChat({
      history: historyMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(lastUserMessage.content.trim());
    const response = result.response;
    const text = response.text();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        {
          error:
            "The diary had nothing to say. It may have been blocked or returned no text. Try rephrasing.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ content: text.trim() });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: toErrorMessage(err) },
      { status: 500 }
    );
  }
}
