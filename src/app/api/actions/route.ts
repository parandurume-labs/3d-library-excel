import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dataMode, getGraphToken, resolveActor } from "@/lib/auth";
import { bookSchema, LibraryError, userSchema } from "@/lib/domain";
import { getRepository } from "@/lib/repository";
import { transition } from "@/lib/transitions";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("loan.request"), bookId: z.string() }),
  z.object({ type: z.literal("reservation.request"), bookId: z.string() }),
  z.object({ type: z.literal("return.request"), loanId: z.string() }),
  z.object({ type: z.literal("reservation.cancel"), reservationId: z.string() }),
  z.object({ type: z.literal("loan.approve"), loanId: z.string(), version: z.number().int() }),
  z.object({ type: z.literal("loan.reject"), loanId: z.string(), version: z.number().int() }),
  z.object({ type: z.literal("return.process"), loanId: z.string(), version: z.number().int() }),
  z.object({ type: z.literal("book.create"), book: bookSchema.omit({ id: true, version: true }) }),
  z.object({ type: z.literal("book.update"), bookId: z.string(), version: z.number().int(), book: bookSchema.omit({ id: true, version: true }).partial() }),
  z.object({ type: z.literal("book.delete"), bookId: z.string(), version: z.number().int() }),
  z.object({ type: z.literal("book.place"), bookId: z.string(), shelfId: z.string(), bin: z.string().min(1), version: z.number().int() }),
  z.object({ type: z.literal("user.create"), user: userSchema.omit({ id: true, version: true }) }),
  z.object({ type: z.literal("user.update"), userId: z.string(), version: z.number().int(), user: userSchema.omit({ id: true, version: true }).partial() }),
  z.object({ type: z.literal("user.role"), userId: z.string(), role: z.enum(["member", "admin"]), version: z.number().int() }),
]);

export async function POST(request: NextRequest) {
  try {
    const token = dataMode === "graph" ? await getGraphToken(request) : undefined;
    const repository = getRepository(token?.graphAccessToken);
    const snapshot = await repository.getSnapshot();
    const actor = await resolveActor(request, snapshot.state, token);
    const action = actionSchema.parse(await request.json());
    const result = transition(snapshot.state, actor, action);
    await repository.commit(result.state, result.expectedVersions);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid action payload.", code: "INVALID_STATE", details: error.issues }, { status: 400 });
    }
    if (error instanceof LibraryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "The update could not be saved to Excel.", code: "GRAPH_ERROR" }, { status: 500 });
  }
}
