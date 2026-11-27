import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const OrderParams = z.object({ id: z.string().uuid() });

const CreateOrderBody = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  note: z.string().max(500).optional(),
});

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'shipped';
  totalCents: number;
}

export interface OrdersStore {
  get(id: string): Promise<Order | undefined>;
  create(input: z.infer<typeof CreateOrderBody>): Promise<Order>;
}

/**
 * Public orders API (v1), used by the storefront and partner integrations.
 *   GET  /orders/:id → { id, status, totalCents }
 *   POST /orders     → { id, status, totalCents }
 */
export default async function ordersRoutes(app: FastifyInstance, opts: { store: OrdersStore }) {
  app.get('/orders/:id', async (req, reply) => {
    const { id } = OrderParams.parse(req.params);
    const order = await opts.store.get(id);
    if (!order) return reply.status(404).send({ error: 'not_found' });
    return order;
  });

  app.post('/orders', async (req, reply) => {
    const body = CreateOrderBody.parse(req.body);
    return opts.store.create(body);
  });
}
