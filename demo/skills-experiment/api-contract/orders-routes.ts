import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const OrderParams = z.object({ orderId: z.string().uuid() });

const CreateOrderBody = z.object({
  customer_id: z.string().min(1),
  items: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
  note: z.string().max(500).optional(),
});

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'shipped';
  total: number;
}

export interface OrdersStore {
  get(id: string): Promise<Order | undefined>;
  create(input: z.infer<typeof CreateOrderBody>): Promise<Order>;
}

/**
 * Public orders API (v1), used by the storefront and partner integrations.
 *   GET  /orders/:orderId → { id, status, total }
 *   POST /orders          → 201 { id, status, total }
 */
export default async function ordersRoutes(app: FastifyInstance, opts: { store: OrdersStore }) {
  app.get('/orders/:orderId', async (req, reply) => {
    const { orderId } = OrderParams.parse(req.params);
    const order = await opts.store.get(orderId);
    if (!order) return reply.status(404).send({ error: 'not_found' });
    return order;
  });

  app.post('/orders', async (req, reply) => {
    const body = CreateOrderBody.parse(req.body);
    const order = await opts.store.create(body);
    reply.status(201);
    return order;
  });
}
