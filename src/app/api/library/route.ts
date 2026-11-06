import { NextRequest, NextResponse } from "next/server";
import { dataMode, getGraphToken, resolveActor } from "@/lib/auth";
import { LibraryError } from "@/lib/domain";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = dataMode === "graph" ? await getGraphToken(request) : undefined;
    const repository = getRepository(token?.graphAccessToken);
    const snapshot = await repository.getSnapshot();
    const actor = await resolveActor(request, snapshot.state, token);
    return NextResponse.json({ ...snapshot, actor });
  } catch (error) {
    if (error instanceof LibraryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "The workbook could not be loaded.", code: "GRAPH_ERROR" }, { status: 500 });
  }
}
