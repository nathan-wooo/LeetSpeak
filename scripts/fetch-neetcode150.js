/**
 * Fetches Neetcode 150 metadata and generates:
 * 1. Minimal problem JSON files in src/problems/ (skips existing)
 * 2. Manifest src/data/neetcode150.json for ListPage
 *
 * Run: node scripts/fetch-neetcode150.js
 */

import { writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROBLEMS_DIR = join(ROOT, 'src', 'problems');
const DATA_DIR = join(ROOT, 'src', 'data');

const NEETCODE_URL = 'https://raw.githubusercontent.com/neetcode-gh/leetcode/main/.problemSiteData.json';

function slugFromLink(link) {
  return (link || '').replace(/\/$/, '');
}

function minimalProblemJson(item) {
  const slug = slugFromLink(item.link);
  const leetcodeUrl = `https://leetcode.com/problems/${slug}/`;
  const videoUrl = item.video ? `https://www.youtube.com/watch?v=${item.video}` : null;

  return {
    id: slug,
    title: item.problem,
    difficulty: item.difficulty,
    topic: item.pattern || 'Other',
    prompt: `See the full problem on LeetCode: ${leetcodeUrl}\n\n${videoUrl ? `Neetcode walkthrough: ${videoUrl}` : ''}\n\nThis is a placeholder. Add full problem content (prompt, examples, tests) to enable Run and hints.`,
    examples: [],
    constraints: [],
    jsStarter: `/**\n * ${item.problem}\n * See: ${leetcodeUrl}\n */\nfunction solution(input) {\n  // Your code here\n  return null;\n}`,
    cppStarter: `#include <vector>\nusing namespace std;\n\n// See: ${leetcodeUrl}\nclass Solution {\npublic:\n    // Implement your solution here\n};`,
    tests: [],
    hints: [
      videoUrl ? `Watch Neetcode's explanation: ${videoUrl}` : null,
      `Full problem: ${leetcodeUrl}`,
    ].filter(Boolean),
    solution: { javascript: '// Add solution when you solve it', cpp: '// Add solution when you solve it' },
  };
}

async function main() {
  console.log('Fetching Neetcode 150 data...');
  const res = await fetch(NEETCODE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();

  const neetcode150 = data.filter((p) => p.neetcode150 === true);
  console.log(`Found ${neetcode150.length} Neetcode 150 problems`);

  await mkdir(PROBLEMS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const existing = new Set(await readdir(PROBLEMS_DIR).catch(() => []));

  const manifest = [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < neetcode150.length; i++) {
    const item = neetcode150[i];
    const slug = slugFromLink(item.link);
    const filename = `${slug}.json`;

    manifest.push({
      id: i + 1,
      title: item.problem,
      problemId: slug,
      difficulty: item.difficulty,
      topic: item.pattern || 'Other',
      solved: false,
      locked: false,
    });

    if (existing.has(filename)) {
      skipped++;
      continue;
    }

    const problemJson = minimalProblemJson(item);
    await writeFile(join(PROBLEMS_DIR, filename), JSON.stringify(problemJson, null, 2));
    created++;
  }

  await writeFile(join(DATA_DIR, 'neetcode150.json'), JSON.stringify(manifest, null, 2));
  console.log(`Created ${created} new problem files, skipped ${skipped} existing`);
  console.log(`Manifest written to src/data/neetcode150.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
