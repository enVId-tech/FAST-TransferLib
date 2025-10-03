import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const dir = join(process.cwd(), 'dist', 'cjs');

await mkdir(dir, { recursive: true });

const packageJson = {
  type: 'commonjs'
};

await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));
