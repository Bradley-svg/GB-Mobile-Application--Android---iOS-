import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import siteRoutes from './routes/siteRoutes';
import deviceRoutes from './routes/deviceRoutes';
import alertRoutes from './routes/alertRoutes';
import telemetryRoutes from './routes/telemetryRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoutes);
app.use('/auth', authRoutes);
app.use(siteRoutes);
app.use(deviceRoutes);
app.use(alertRoutes);
app.use(telemetryRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

export default app;
