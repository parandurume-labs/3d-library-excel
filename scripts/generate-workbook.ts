import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { createWorkbook, normalizeDemoBookCount } from "../src/lib/workbook";
import { createDemoState } from "../src/lib/demo-data";

async function main() {
  const output = resolve(process.cwd(), process.argv[2] ?? "artifacts/3d-library-demo.xlsx");
  await mkdir(resolve(output, ".."), { recursive: true });
  const countArgument = Number(process.env.DEMO_BOOK_COUNT ?? 520);
  const count = normalizeDemoBookCount(countArgument);
  const workbook = createWorkbook(createDemoState(count, new Date("2026-01-01T00:00:00.000Z")));
  const source = await workbook.xlsx.writeBuffer();
  const archive = await JSZip.loadAsync(source);
  const zipDate = new Date("2026-01-01T00:00:00.000Z");
  for (const entry of Object.values(archive.files)) entry.date = zipDate;
  const bytes = await archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "DOS",
  });
  await writeFile(output, bytes);
  console.log(`Generated ${count} clearly marked synthetic demo books: ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
