# Sources

The rules in this skill come from these sources. Each entry says what it backs.

## Onion, Clean, Hexagonal

- Jeffrey Palermo, *The Onion Architecture*:
  [part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/),
  [part 2](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/),
  [part 3](https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/),
  [part 4: after four years](https://jeffreypalermo.com/tag/onion-architecture).
  Part 3 holds the four tenets: an independent core, inner rings define interfaces,
  coupling toward the centre, a core that runs without infrastructure.
- Robert C. Martin, [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
  The Dependency Rule: source dependencies point inward.
- Alistair Cockburn, [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
  (overview: [Wikipedia](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))).
  Ports and adapters, driving and driven sides.
- Herberto Graça, [Onion Architecture](https://herbertograca.com/2017/09/21/onion-architecture/)
  and [Explicit Architecture: DDD, Hexagonal, Onion, Clean, CQRS](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/).
  How the rings, ports and composition root fit together.
- [NDepend: Onion Architecture layers](https://blog.ndepend.com/onion-architecture-layers/),
  [Allegro Tech: Onion Architecture](https://blog.allegro.tech/2023/02/onion-architecture.html).
  Practical summaries and the trade-offs.
- Martin Fowler:
  [Repository](https://www.martinfowler.com/eaaCatalog/repository.html),
  [Gateway](https://www.martinfowler.com/articles/gateway-pattern.html),
  [Presentation-Domain-Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html).
  Repository ports and adapter-as-gateway.

## TypeScript / Node reference implementations

- [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon)
- [marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate): Fastify 5 with clean and onion layering
- [Remo Jansen: Onion Architecture in Node.js with TypeScript](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad)

## Fastify

- [Plugins Guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/),
  [Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/),
  [Testing](https://fastify.dev/docs/latest/Guides/Testing/).
  Plugin scope, decorators, `inject()`.
- [Eomm: Fastify encapsulation](https://www.github.com/Eomm/blog-posts/blob/master/posts/bonus-fastify-encapsulation.md)

## Drizzle, transactions, repositories

- [Drizzle: Transactions](https://orm.drizzle.team/docs/transactions)
- [Sentry: Atomic repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript).
  Transactions belong to the use case, and repositories accept `Db | Tx`.
- [Transactions with DDD and Repository pattern in TypeScript (Unit of Work)](https://medium.com/@joaojbs199/transactions-with-ddd-and-repository-pattern-in-typescript-a-guide-to-good-implementation-part-2-da0af3e10901)

## Zod and boundaries

- Alexis King, [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Boundary Defense (kamae-ts)](https://iwasa-kosui.github.io/kamae-ts/en/boundary-defense.html),
  [Validation at the Boundary](https://jagreehal.github.io/jagreehal-typescript-patterns/patterns/validation)

## Enforcement

- dependency-cruiser [rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
  and [rules tutorial](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-tutorial.md).
  `forbidden` rules, `$1` group matching, `--ignore-known` baselines.
- [Validate dependencies according to Clean Architecture](https://medium.com/better-programming/validate-dependencies-according-to-clean-architecture-743077ea084c)
