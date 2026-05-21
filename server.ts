import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DBManager, POSTGRES_SCHEMA } from './server/db';
import { calculateCamels } from './server/calculator';
import { TradeCalculationInput } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic middleware configuration
  app.use(express.json());

  // Logging requests tracking
  app.use((req, res, next) => {
    const routeStart = performance.now();
    res.on('finish', () => {
      const elapsed = performance.now() - routeStart;
      // Log non-assets requests
      if (!req.path.startsWith('/@') && !req.path.includes('.') && !req.path.startsWith('/src/')) {
        DBManager.logDirectly('INFO', `REST Request: ${req.method} ${req.path} - responded ${res.statusCode}`, elapsed);
      }
    });
    next();
  });

  // REST API Route Definitions (API routes go here FIRST)
  
  // 1. Health monitor Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', datetime: new Date().toISOString(), platform: 'Cloud Run Sandbox' });
  });

  // 2. Clear SQL calculations
  app.post('/api/reset', async (req, res) => {
    try {
      await DBManager.clearAll();
      res.json({ message: 'PostgreSQL SIM instance database wiped successfully.' });
    } catch (err: any) {
      DBManager.logDirectly('ERROR', `RESET query error: ${err.message}`);
      res.status(500).json({ error: 'Failed to erase tables', details: err.message });
    }
  });

  // 3. Trade Calculation calculator endpoint
  app.post('/api/trades', async (req, res) => {
    try {
      const input = req.body as TradeCalculationInput;
      if (!input || !input.category || !input.breedId) {
        DBManager.logDirectly('WARN', `POST /api/trades failed validation - Missing category or breedId`);
        return res.status(400).json({ error: 'Bad Request', details: 'A trade category and Camel breed choice are mandatory.' });
      }

      // Check for boundaries/errors in nested data (Robust Error Handling!)
      if (input.category === 'car' && (!input.details || !input.details.carType)) {
        return res.status(400).json({ error: 'Validation Error', details: 'Car calculations require a car category type.' });
      }

      const result = calculateCamels(input);
      const savedResult = await DBManager.insertTrade(result);
      
      res.status(201).json(savedResult);
    } catch (err: any) {
      DBManager.logDirectly('ERROR', `Trade processing failure: ${err.message}`);
      res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  });

  // 4. Retrieve trades with query evaluation tracing
  app.get('/api/trades', async (req, res) => {
    try {
      const categoryFilter = req.query.category as string || '';
      let sql = 'SELECT * FROM trade_calculations ORDER BY timestamp DESC;';
      let params: any[] = [];
      
      if (categoryFilter) {
        sql = `SELECT * FROM trade_calculations WHERE category = '${categoryFilter}' ORDER BY timestamp DESC;`;
        params = [categoryFilter];
      }

      const { rows, explain } = await DBManager.query<any>(sql, params);
      
      // Filter the actual rows matched to match SQL behavior
      let filteredRows = rows;
      if (categoryFilter) {
        filteredRows = rows.filter(t => t.category === categoryFilter);
      }

      res.json({
        data: filteredRows,
        explainPlan: explain,
        sqlUsed: sql
      });
    } catch (err: any) {
      DBManager.logDirectly('ERROR', `Fetch trades SQL error: ${err.message}`);
      res.status(500).json({ error: 'Failed to complete select statement', details: err.message });
    }
  });

  // 5. Query cluster metrics
  app.get('/api/analytics', async (req, res) => {
    try {
      // Simulate real index calculations
      const stats = await DBManager.getStats();
      res.json(stats);
    } catch (err: any) {
      DBManager.logDirectly('ERROR', `Analytics pipeline crash: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch cluster stats', details: err.message });
    }
  });

  // 6. Output live logs
  app.get('/api/logs', (req, res) => {
    const logs = DBManager.getLogs();
    res.json({ logs });
  });

  // 7. Get raw PostgreSQL DDL schemas
  app.get('/api/schema', (req, res) => {
    res.json({ schema: POSTGRES_SCHEMA });
  });

  // Express API Documentation Endpoint (Self-Documenting API!)
  app.get('/api/docs', (req, res) => {
    res.json({
      title: 'PostgreSQL-backed Camel Trade API',
      version: '1.0.0',
      description: 'API endpoints supporting Camel values calculation, desert survival scoring, and enterprise analytics reporting.',
      endpoints: [
        {
          path: '/api/trades',
          method: 'POST',
          description: 'Runs complex evaluation routines to determine camel valuation payouts. Persists audit trails in DB.',
          bodySchema: {
            category: 'car | wife_girlfriend | husband_boyfriend | device | soul',
            breedId: 'dromedary | bactrian | wild_bactrian | hybrid_alkahl',
            quizScore: '0..100',
            details: 'category-specific attributes (purity, year, cooking etc.)'
          }
        },
        {
          path: '/api/trades',
          method: 'GET',
          description: 'Returns query list. Supports optional "category" query string query filtering.',
          queryParameters: {
            category: 'Optional string key'
          }
        },
        {
          path: '/api/analytics',
          method: 'GET',
          description: 'Dumps advanced global telemetry datasets regarding category aggregates and DB connection pool statuses.'
        },
        {
          path: '/api/logs',
          method: 'GET',
          description: 'Yields system activity records and PostgreSQL query trace streams for audits.'
        },
        {
          path: '/api/schema',
          method: 'GET',
          description: 'Serves standard SQL migrations script for deployment on real remote servers.'
        }
      ]
    });
  });

  // Interactive UI Client Asset router mount
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server securely running on port ${PORT}`);
    DBManager.logDirectly('INFO', `Express Application serving Camel Calculator on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server crash on startup:', err);
});
