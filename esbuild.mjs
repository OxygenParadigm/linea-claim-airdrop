import * as esbuild from 'esbuild';

async function buildMain() {
  await esbuild
    .build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      format: 'cjs',
      minify: process.argv.includes('--minify'),
      outfile: 'dist/index.js',
      allowOverwrite: true,
      platform: 'node',
      target: 'node20',
      external: ['jsonc-parser'],
    })
    .catch(() => process.exit(1));
}

buildMain().catch(() => process.exit(1));
