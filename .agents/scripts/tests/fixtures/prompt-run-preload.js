import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const spawn = childProcess.spawn;
childProcess.spawn = (command, args, options) => {
  if (!args[0]?.endsWith('/run-hi-mcp-prompt.js')) {
    throw new Error('Unexpected child process in the runner test');
  }
  return spawn(
    command,
    [
      fileURLToPath(new URL('./prompt-run.js', import.meta.url)),
      ...args.slice(1),
    ],
    options
  );
};
syncBuiltinESMExports();
