require('dotenv').config();
const express = require('express');
const cors = require('cors');

const redesignRouter = require('./routes/redesign');
const snapshotRouter = require('./routes/snapshot');
const jobsRouter = require('./routes/jobs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '50mb' }));

app.use('/api/redesign', redesignRouter);
app.use('/api/snapshot', snapshotRouter);
app.use('/api/jobs', jobsRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`\x1b[36m✦ WebSight backend\x1b[0m  http://localhost:${PORT}`);
});
