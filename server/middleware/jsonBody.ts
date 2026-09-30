import express, { type Application } from 'express';

export function registerJsonBodyParsers(app: Application): void {
  app.use('/api/skema/projects/:id', express.json({ limit: '10mb' }));
  app.use('/api/skema/generate-html', express.json({ limit: '5mb' }));
  app.use('/api/skema-agent/chat', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '1mb' }));
}
