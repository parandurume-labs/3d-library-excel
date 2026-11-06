import { createDemoState } from "../demo-data";
import { LibraryError, type LibraryRepository, type LibrarySnapshot, type LibraryState } from "../domain";

let demoState: LibraryState = createDemoState();

export class LocalDemoRepository implements LibraryRepository {
  readonly mode = "demo" as const;

  async getSnapshot(): Promise<LibrarySnapshot> {
    return { state: structuredClone(demoState), mode: "demo", schemaVersion: 1 };
  }

  async commit(next: LibraryState, expectedVersions: Record<string, number>): Promise<void> {
    const currentById = Object.values(demoState).flat().reduce<Record<string, { version: number }>>((all, item) => {
      all[item.id] = item;
      return all;
    }, {});
    for (const [id, version] of Object.entries(expectedVersions)) {
      if ((currentById[id]?.version ?? 0) !== version) {
        throw new LibraryError(`Record ${id} changed before this update. Reload and try again.`, "CONFLICT", 409);
      }
    }
    demoState = structuredClone(next);
  }

  reset() {
    demoState = createDemoState();
  }
}

export const localRepository = new LocalDemoRepository();
