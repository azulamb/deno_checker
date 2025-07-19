# deno_checker

https://jsr.io/@azulamb/checker

## Sample

```ts
import * as checker from "jsr:@azulamb/checker";
import data from './deno.json' with { type: 'json' };

await checker.check(
  checker.DenoVersionCheck(),
  checker.VersionCheck(data.version),
  checker.JsrPublishCheck(),
);
```
