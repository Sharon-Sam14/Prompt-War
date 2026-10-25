/**
 * Test-only stand-in for the `server-only` package.
 * The real package throws when imported outside a React Server context;
 * vitest runs in plain Node, so we alias to this no-op instead
 * (see vitest.config.ts resolve.alias).
 */
export {};
