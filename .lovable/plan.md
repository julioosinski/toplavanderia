

## Fix: Build failure due to missing native bindings

The dev server fails because `@swc/core` (used by `@vitejs/plugin-react-swc`) cannot find its native Linux binary. This is a known issue in this project's environment.

### Change

**`package.json`** — Add native binding overrides to `devDependencies`:

```json
"@rollup/rollup-linux-x64-gnu": "4.24.0",
"@swc/core-linux-x64-gnu": "1.7.39"
```

Then reinstall dependencies so the bindings are available.

### Why

The SWC plugin (`@vitejs/plugin-react-swc`) requires a platform-specific native binary. In the Linux sandbox environment, `@swc/core-linux-x64-gnu` must be explicitly listed to ensure it gets installed. Same for `@rollup/rollup-linux-x64-gnu`.

