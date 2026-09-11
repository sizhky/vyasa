import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

function fail(error) {
  process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}

function isInside(root, target) {
  const relativePath = relative(root, target);
  return relativePath && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath);
}

function extractTag(html, name) {
  return html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] || '';
}

async function renderedPage(output, pageName) {
  const { readdir } = await import('node:fs/promises');
  const pages = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const target = join(folder, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.name === `${pageName}.html`) pages.push(target);
    }
  }
  await visit(output);
  if (pages.length !== 1) throw new Error(`Astro did not produce one page for ${pageName}.`);
  return readFile(pages[0], 'utf8');
}

async function globalStyleImport(root, page) {
  for (const candidate of ['src/styles/globals.css', 'src/styles/global.css']) {
    const style = join(root, candidate);
    try {
      await access(style);
    } catch {
      continue;
    }
    const specifier = relative(dirname(page), style).split(sep).join('/');
    const importPath = specifier.startsWith('.') ? specifier : `./${specifier}`;
    return `import ${JSON.stringify(importPath)};\n`;
  }
  return '';
}

async function render({ project, document }) {
  const root = resolve(project);
  const source = resolve(document);
  if (!isInside(root, source)) throw new Error('Astro document must stay inside its project root.');
  const pages = join(root, 'src', 'pages');
  const pageName = `vyasa_mdx_${randomUUID().replaceAll('-', '')}`;
  const page = join(pages, `${pageName}.astro`);
  const output = await mkdtemp(join(tmpdir(), 'vyasa-astro-'));
  const specifier = relative(dirname(page), source).split(sep).join('/');
  const importPath = specifier.startsWith('.') ? specifier : `./${specifier}`;
  const globalStyles = await globalStyleImport(root, page);
  const requireFromProject = createRequire(join(root, 'package.json'));
  const astroUrl = pathToFileURL(requireFromProject.resolve('astro')).href;
  try {
    await writeFile(page, `---\n${globalStyles}import { Content } from ${JSON.stringify(importPath)};\n---\n<Content />\n`, 'utf8');
    const { build } = await import(astroUrl);
    await build({ root, outDir: output, logLevel: 'silent', build: { format: 'file', inlineStylesheets: 'always' } });
    const pageHtml = await renderedPage(output, pageName);
    const body = (extractTag(pageHtml, 'body') || pageHtml).replace(/^<!doctype html>/i, '');
    return body;
  } finally {
    await Promise.allSettled([unlink(page), rm(output, { recursive: true, force: true })]);
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    process.stdout.write(JSON.stringify({ html: await render(JSON.parse(input)) }));
  } catch (error) {
    fail(error);
  }
});
