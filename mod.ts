import data from './deno.json' with { type: 'json' };

/**
 * Current version of this module.
 */
export const VERSION = data.version;

/**
 * CheckItem represents a single check item with a name, an optional command to execute,
 */
export type CheckItem = {
  /** The name of the check item. */
  name: string;
  /**
   * The command to execute for this check item.
   * If not provided, the `after` function will be called directly.
   */
  command?: string[];
  /**
   * A function that will be called after the command is executed.
   * It receives the result of the command execution and should return a message or void.
   */
  after: (
    result: ExecResult,
  ) => Promise<string | void>;
};

/**
 * ExecResult represents the result of executing a command.
 */
export type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/**
 * Executes a command and returns the result.
 * @param command The command to execute.
 * @returns ExecResult containing the exit code, standard output, and standard error.
 */
export async function exec(command: string[]): Promise<ExecResult> {
  const { code, stdout, stderr } = await new Deno.Command(
    command.shift() as string,
    {
      args: command,
    },
  ).output();

  return {
    code: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

function exit(message: string) {
  console.error(`%c[Error] ${message}`, 'color: red');
  Deno.exit(1);
}

function start(name: string) {
  console.log(`== ${name} `.padEnd(80, '='));
}

function complete(message: string) {
  console.log(`%c${message}`, 'color: green');
}

/**
 * Checks if the current version is updated.
 * @param nowVersion The current version.
 * @param newVersion The new version to check against.
 * @returns True if the current version is updated, false otherwise.
 */
export function isUpdatedVersion(
  nowVersion: string,
  newVersion: string,
): boolean {
  const v1 = nowVersion.split('.').map((v) => {
    return parseInt(v.replace(/[^0-9]+/g, ''));
  });
  const v2 = newVersion.split('.').map((v) => {
    return parseInt(v.replace(/[^0-9]+/g, ''));
  });
  for (let i = 0; i < 3; ++i) {
    if (v1[i] < v2[i]) {
      return true;
    }
  }
  return false;
}

/**
 * Creates a Deno version checker that checks if the current Deno version is the latest stable version.
 * @returns A CheckItem that checks the Deno version.
 */
export function createDenoVersionChecker(): CheckItem {
  return {
    name: 'Deno version check',
    command: ['deno', 'upgrade', '--dry-run'],
    after: (result) => {
      let version = '';
      result.stderr.split('\n').forEach((line) => {
        line = line.trim();
        const v = line.replace(
          /^Found latest stable version .*v([0-9.]+).*$/,
          '$1',
        );
        if (v !== line && !v.match(/[^0-9.]/)) {
          version = v;
        }
      });
      if (!version) {
        return Promise.resolve('This deno version is latest');
      }
      return Promise.reject(
        new Error(`Found latest version: ${version}\nExec \`deno upgrade\``),
      );
    },
  };
}

/**
 * Creates a version checker that checks if the current version is updated.
 * Current version is latest tag in git.(Format: v1.2.3)
 * @param version The version to check against the latest version.(Format 1.2.3)
 * @returns A CheckItem that checks the version.
 */
export function createVersionChecker(version: string): CheckItem {
  return {
    name: 'VERSION check',
    command: ['git', 'describe', '--tags', '--abbrev=0'],
    after: (result) => {
      return Promise.resolve(result.stdout.replace(/\s/g, '')).then((tag) => {
        console.log(`Now tag: ${tag} Now ver: ${version}`);
        if (!isUpdatedVersion(tag, version)) {
          throw new Error(
            'VERSION is not updated. Update deno.json & deno task version',
          );
        }
      });
    },
  };
}

/**
 * Creates a JSR publish checker that checks if the current module is ready for publishing.
 * @returns A CheckItem that checks the JSR publish status.
 */
export function createJsrPublishChecker(): CheckItem {
  return {
    name: 'JSR Publish check',
    command: ['deno', 'publish', '--dry-run'],
    after: (result) => {
      if (result.code === 0) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(result.stderr));
    },
  };
}

/**
 * Executes a series of checks defined in the provided list.
 * @param list The list of check items to execute.
 */
export async function check(...list: CheckItem[]) {
  for (const check of list) {
    start(check.name);
    const p = check.command
      ? exec(check.command).then(check.after)
      : check.after({ code: 0, stdout: '', stderr: '' });
    await p.then((msg) => {
      complete(`OK ... ${check.name}${msg ? ': ' + msg : ''}`);
    }).catch((error) => {
      exit(error.message);
    });
  }
}

if (import.meta.main) {
  await check(
    createDenoVersionChecker(),
    createVersionChecker(VERSION),
    createJsrPublishChecker(),
  );
}
