import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import siteRoutes from './routes/siteRoutes';
import deviceRoutes from './routes/deviceRoutes';
import alertRoutes from './routes/alertRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRoutes);
app.use(siteRoutes);
app.use(deviceRoutes);
app.use(alertRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

export default app;
