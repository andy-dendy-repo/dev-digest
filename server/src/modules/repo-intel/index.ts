/**
 * repo-intel module barrel — the public surface for the composition root.
 * Other modules import the specific file they need (types, constants, ports),
 * never this barrel (it re-exports the repository).
 */
export * from './types.js';
export * from './constants.js';
export * from './ports.js';
export * from './service.js';
export * from './indexing.js';
export * from './repository.js';
export { default as repoIntelRoutes } from './routes.js';
