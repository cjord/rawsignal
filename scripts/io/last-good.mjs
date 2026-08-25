import fs from "node:fs/promises";
import path from "node:path";
import { validateCatalogSnapshot } from "../validate/catalog.mjs";

export async function publishValidatedFiles(files, options = {}) {
  const { fsApi = fs, suffix = `.staged-${process.pid}` } = options;
  const staged = [];
  try {
    for (const [target, value] of Object.entries(files)) {
      await fsApi.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}${suffix}`;
      await fsApi.writeFile(temporary, typeof value === "string" ? value : JSON.stringify(value));
      staged.push([temporary, target]);
    }
    for (const [temporary, target] of staged) await fsApi.rename(temporary, target);
  } catch (error) {
    await Promise.allSettled(staged.map(([temporary]) => fsApi.rm(temporary, { force: true })));
    throw error;
  }
}

export async function publishCatalogSnapshot(snapshot, files, options = {}) {
  const counts = validateCatalogSnapshot({ ...snapshot, ...(options.validation ?? {}) });
  await publishValidatedFiles(files, options);
  return counts;
}
