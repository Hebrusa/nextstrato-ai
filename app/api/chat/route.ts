import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  let messages: Anthropic.MessageParam[];
  let systemPrompt: string | undefined;

  try {
    const body = await req.json();
    messages = body.messages;
    systemPrompt = body.systemPrompt;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages must be a non-empty array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8096,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text", text: event.delta.text });
          } else if (event.type === "message_stop") {
            send({ type: "done" });
          }
        }
      } catch (err) {
        const error = err as Anthropic.APIError;

        if (err instanceof Anthropic.AuthenticationError) {
          send({ type: "error", code: "auth_error", message: "Invalid or missing API key" });
        } else if (err instanceof Anthropic.RateLimitError) {
          send({ type: "error", code: "rate_limit", message: "Rate limit exceeded, please retry later" });
        } else if (err instanceof Anthropic.APIConnectionError) {
          send({ type: "error", code: "connection_error", message: "Could not reach Anthropic API" });
        } else if (err instanceof Anthropic.APIError) {
          send({ type: "error", code: "api_error", message: error.message, status: error.status });
        } else {
          send({ type: "error", code: "unknown_error", message: "An unexpected error occurred" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
