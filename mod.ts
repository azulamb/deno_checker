import data from './deno.json' with { type: 'json' };

export const VERSION = data.version;

export type CheckItem = {
  name: string;
  command?: string[];
  after: (
    result: { code: number; stdout: string; stderr: string },
  ) => Promise<string | void>;
};

export async function exec(command: string[]) {
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

function versionCheck(nowTag: string, noeVer: string) {
  const v1 = nowTag.split('.').map((v) => {
    return parseInt(v);
  });
  const v2 = noeVer.split('.').map((v) => {
    return parseInt(v);
  });
  for (let i = 0; i < 3; ++i) {
    if (v1[i] < v2[i]) {
      return true;
    }
  }
  return false;
}

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

export function createVersionChecker(version: string): CheckItem {
  return {
    name: 'VERSION check',
    command: ['git', 'describe', '--tags', '--abbrev=0'],
    after: (result) => {
      return Promise.resolve(result.stdout.replace(/\s/g, '')).then((tag) => {
        console.log(`Now tag: ${tag} Now ver: ${version}`);
        if (!versionCheck(tag, version)) {
          throw new Error(
            'VERSION is not updated. Update deno.json & deno task version',
          );
        }
      });
    },
  };
}

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
