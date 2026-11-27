# Fastify: the Presentation ring

Fastify is a delivery mechanism. A route translates HTTP into a use-case call and the
result back into HTTP, and that is all it does. Business decisions and data access
stay out of it, so the same use case can be driven by a route, a job, a CLI, or a
test.

## A thin route

```ts
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const pulls = new PullsService({                 // build from ports, not from the Container
    pulls: app.container.pullsRepo,                // implements PullsPort
    costs: app.container.reviewRepo,               // implements RunCostsPort
    github: () => app.container.github(),
  });

  app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req): Promise<PrMeta[]> => {
    const { workspaceId } = await getContext(app.container, req);
    return pulls.listForRepo(workspaceId, req.params.id);   // parse → call → return
  });
}
```

A route may:
- validate and parse params, query and body with a Zod schema (`fastify-type-provider-zod`);
- declare its 2xx body as `schema.response` from the `@devdigest/shared` contract. The
  zod serializer **parses** the body: unknown keys are dropped, `.default()`s are filled
  in, and a mismatch becomes a generic 500 (`isResponseSerializationError` in `app.ts`).
  So a contract with defaults (`Settings`) or a stored document that may predate its
  contract (`RunTrace`) stays without one;
- resolve the request context (`getContext`);
- call one use case;
- set headers, status codes for success variants, SSE framing.

Everything else (queries, loops over rows, calls to GitHub or an LLM, deciding what a
status means) belongs in the service. Workspace ownership of an `:id` is a service rule
too (`ReviewService.assertRunInWorkspace` → 404); only a tenant-agnostic facade gets a
presentation-side guard (`_shared/ownership.ts`, used by repo-intel routes).

## Wiring services

- `app.container` is decorated once in `src/app.ts`. A route plugin reads it **only to
  build services**, passing each service the specific ports it needs. The route is the
  edge of the onion, so it may see the container. Services never do: the
  `core-no-container` rule enforces that.
- One service instance per plugin registration is fine. Services are stateless over
  their ports.
- Module plugins are encapsulated: each `routes.ts` is its own plugin, registered from
  `src/modules/index.ts`. Share app-wide things (container, auth context) through
  decorators set in `app.ts`. Keep feature state inside the feature plugin. Wrap with
  `fastify-plugin` only when a decorator must escape to the parent context, on purpose.

## Errors

- Use cases throw the named errors from `src/platform/errors.ts` (`NotFoundError`,
  `ValidationError`, `ExternalServiceError`, `ConfigError`, or a new `AppError`
  subclass with a stable `code`).
- The single `setErrorHandler` in `app.ts` turns them into the `{ error: { code,
  message, details } }` envelope and the HTTP status. Services never touch `reply` and
  never pick a status code inline.
- A new error kind gets a new subclass in `errors.ts`. Mapping it is a
  presentation concern that stays in the error handler.

## SSE and long runs

The run bus (`platform/sse.ts`) is infrastructure. A use case publishes events through
the injected `RunBus` interface. The route only subscribes and streams.
