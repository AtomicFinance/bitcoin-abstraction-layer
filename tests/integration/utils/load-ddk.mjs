// The ddk engine is ESM-only: its package `exports` offer no `require`
// condition, so the CommonJS test files cannot `require()` it, and TypeScript's
// CommonJS output would turn a dynamic `import()` into `require()`. Mocha
// awaits an ESM `--require` module before it loads any spec, so the engine is
// imported here, once, and handed to the specs through `ddkEngine()`.
// Set DDK_ENGINE_MODULE to a built engine's file URL to test an unreleased binding.
globalThis.__balTestDdk = await import(
  process.env.DDK_ENGINE_MODULE || '@bennyblader/ddk-ts'
);
