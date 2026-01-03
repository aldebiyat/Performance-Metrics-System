import { execSync } from 'child_process';
import path from 'path';

describe('No console statements in production code', () => {
  it('should not use console.log in source files', () => {
    const srcDir = path.join(__dirname, '..', '..', 'src');

    try {
      const result = execSync(
        `grep -rn "console\\." "${srcDir}" --include="*.ts" | grep -v ".test.ts" | grep -v "__tests__" | grep -v "// eslint-disable"`,
        { encoding: 'utf8' }
      );

      // If we get here, console statements were found
      throw new Error(`Found console statements in source code:\n${result}`);
    } catch (error: any) {
      // grep returns exit code 1 when no matches found - that's what we want
      if (error.status !== 1) {
        throw error;
      }
    }
  });
});
