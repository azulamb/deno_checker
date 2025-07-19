# deno_checker

https://jsr.io/@azulamb/checker

A library for performing pre-release checks.

## Sample

```ts
import * as checker from "jsr:@azulamb/checker";
import data from '../deno.json' with { type: 'json' };

await checker.check(
  checker.createDenoVersionChecker(),
  checker.createVersionChecker(data.version),
  checker.createJsrPublishChecker(),
);
```

### createVersionChecker

Need `git` command.

If set tag `v[X].[Y].[Z]`, compare version `[X].[Y].[Z]`.
