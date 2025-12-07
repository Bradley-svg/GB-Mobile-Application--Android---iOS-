import 'dotenv/config';
import express from 'express';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import siteRoutes from './routes/siteRoutes';
import deviceRoutes from './routes/deviceRoutes';
import alertRoutes from './routes/alertRoutes';
import workOrdersRoutes from './routes/workOrdersRoutes';
import telemetryRoutes from './routes/telemetryRoutes';
import heatPumpHistoryRoutes from './routes/heatPumpHistoryRoutes';
import userPreferencesRoutes from './routes/userPreferencesRoutes';
import fleetRoutes from './routes/fleetRoutes';
import { errorHandler } from './middleware/errorHandler';
import { createCorsMiddleware } from './middleware/corsConfig';
import { logger } from './config/logger';

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());

app.use(healthRoutes);
app.use('/auth', authRoutes);
app.use(siteRoutes);
app.use(deviceRoutes);
app.use(alertRoutes);
app.use(workOrdersRoutes);
app.use(telemetryRoutes);
app.use(heatPumpHistoryRoutes);
app.use(userPreferencesRoutes);
app.use(fleetRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(
      { module: 'server', port: PORT, env: process.env.NODE_ENV || 'development' },
      'backend listening'
    );
  });
}

export default app;
