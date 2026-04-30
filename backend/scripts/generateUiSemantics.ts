/**
 * Build script: emit `backend/src/voice/generated/uiSemantics.generated.ts`
 * with the latest UI semantics corpus (UI nodes, form schemas, API routes,
 * DB tables, and hand-authored workflow docs).
 *
 * Run with: `tsx backend/scripts/generateUiSemantics.ts`
 *
 * The runtime (`backend/src/voice/uiSemantics.ts#buildUiSemanticsCorpus`) can
 * also build the corpus on demand at boot; the generated file is the
 * checked-in baseline that ships with the build (so prod has a fallback when
 * a regen step is skipped).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildUiSemanticsCorpus } from '../src/voice/uiSemantics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const corpus = buildUiSemanticsCorpus();
  const outDir = path.resolve(__dirname, '..', 'src', 'voice', 'generated');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'uiSemantics.generated.ts');

  const banner = `// AUTO-GENERATED FILE - DO NOT EDIT.\n// Run \`tsx backend/scripts/generateUiSemantics.ts\` to refresh.\n\n`;
  const body = `import type { UiSemanticDoc, UiSemanticsCorpus } from '../uiSemantics.js';\n\nexport const GENERATED_UI_SEMANTICS: UiSemanticsCorpus = ${stringify(corpus)} as UiSemanticsCorpus;\n\nexport const GENERATED_UI_SEMANTICS_DOCS: UiSemanticDoc[] = GENERATED_UI_SEMANTICS.docs;\n`;
  await fs.writeFile(outPath, banner + body, 'utf8');
  console.log(`Wrote ${outPath} (${corpus.docs.length} docs, hash=${corpus.hash.slice(0, 12)})`);
}

function stringify(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent);
}

main().catch((err) => {
  console.error('generateUiSemantics failed', err);
  process.exit(1);
});
