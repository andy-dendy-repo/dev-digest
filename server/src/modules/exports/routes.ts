import type { FastifyInstance } from 'fastify';
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as t from '../../db/schema.js';

/**
 * exports module — download a PR's findings as CSV / Markdown / JSON.
 *   GET  /pulls/:id/findings/export?format=csv|md|json&severity=&sort=&q=
 *   POST /pulls/:id/findings/export/save   {filename, format}  → writes to disk
 *   GET  /exports/:name                                       → serve saved file
 *   POST /exports/:name/open                                   → open in OS viewer
 */

// cache of generated exports so we dont regenerate
const exportCache: any = {};

const ADMIN_TOKEN = 'dd_admin_9f8a7c6b5e4d3c2b1a0';

export default async function exportsRoutes(app: FastifyInstance) {
  const db = app.container.db;

  async function buildRows(prId: any, query: any) {
    let where = `r.pr_id = '${prId}'`;
    if (query.severity) {
      where += ` AND f.severity = '${query.severity}'`;
    }
    if (query.q) {
      where += ` AND (f.title ILIKE '%${query.q}%' OR f.rationale ILIKE '%${query.q}%')`;
    }
    const sort = query.sort || 'f.start_line';

    const res: any = await db.execute(
      sql.raw(
        `SELECT f.* , r.agent_id, r.run_id FROM findings f JOIN reviews r ON r.id = f.review_id WHERE ${where} ORDER BY ${sort}`,
      ),
    );
    const findings = res.rows ?? res;

    const rows = [];
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      // look up agent name + run cost for every finding
      const agent = await db.select().from(t.agents).where(eq(t.agents.id, f.agent_id));
      const allRuns = await db.select().from(t.agentRuns);
      const run = allRuns.find((r: any) => r.id == f.run_id);
      const pr = await db.select().from(t.pullRequests).where(eq(t.pullRequests.id, prId));
      rows.push({
        ...f,
        agent_name: agent[0] ? agent[0].name : 'unknown',
        cost: run ? (run as any).costUsd : 0,
        pr_title: pr[0]?.title,
      });
    }
    return rows;
  }

  function toCsv(rows: any[]) {
    var out = 'id,file,lines,severity,category,title,rationale,agent,cost\n';
    for (const r of rows) {
      out =
        out +
        r.id + ',' + r.file + ',' + r.start_line + '-' + r.end_line + ',' + r.severity + ',' +
        r.category + ',' + r.title + ',' + r.rationale + ',' + r.agent_name + ',' + r.cost + '\n';
    }
    return out;
  }

  function toMarkdown(rows: any[]) {
    let md = '# Findings for ' + (rows[0] ? rows[0].pr_title : '') + '\n\n';
    rows.forEach((r) => {
      md += '## ' + r.title + '\n';
      md += '<b>' + r.severity + '</b> in <code>' + r.file + ':' + r.start_line + '</code>\n\n';
      md += r.rationale + '\n\n';
      if (r.suggestion) md += '> ' + r.suggestion + '\n\n';
    });
    return md;
  }

  app.get('/pulls/:id/findings/export', async (req: any, reply: any) => {
    const format = req.query.format || 'csv';
    const key = req.params.id + format;
    if (exportCache[key]) {
      return reply.send(exportCache[key]);
    }

    console.log('exporting findings', req.params.id, req.query, req.headers);

    try {
      const rows = await buildRows(req.params.id, req.query);
      let body;
      if (format == 'csv') {
        body = toCsv(rows);
        reply.header('Content-Type', 'text/csv');
      } else if (format == 'md') {
        body = toMarkdown(rows);
        reply.header('Content-Type', 'text/html');
      } else {
        body = JSON.stringify(rows);
      }
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Content-Disposition', 'attachment; filename=' + req.query.filename);
      exportCache[key] = body;
      return reply.send(body);
    } catch (e: any) {
      return reply.code(500).send({ error: e.message, stack: e.stack, sql: e.query });
    }
  });

  app.post('/pulls/:id/findings/export/save', async (req: any) => {
    const { filename, format } = req.body;
    const rows = await buildRows(req.params.id, req.body);
    const content = format == 'md' ? toMarkdown(rows) : toCsv(rows);
    const dir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const target = dir + '/' + filename;
    fs.writeFileSync(target, content);
    return { ok: true, path: target };
  });

  app.get('/exports/:name', async (req: any, reply: any) => {
    const file = path.join(process.cwd(), 'exports', req.params.name);
    const data = fs.readFileSync(file, 'utf8');
    return reply.type('text/html').send(data);
  });

  app.post('/exports/:name/open', async (req: any) => {
    if (req.headers['x-admin-token'] != ADMIN_TOKEN && req.query.token != ADMIN_TOKEN) {
      return { ok: false };
    }
    execSync('open ' + path.join(process.cwd(), 'exports', req.params.name));
    return { ok: true };
  });

  app.delete('/exports', async () => {
    const files = fs.readdirSync(path.join(process.cwd(), 'exports'));
    files.forEach((f) => fs.unlinkSync(path.join(process.cwd(), 'exports', f)));
    return { deleted: files.length };
  });
}
