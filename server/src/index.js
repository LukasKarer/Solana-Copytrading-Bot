import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import apiRoutes from './routes/api.js';

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Logging

// Routes
app.use('/api', apiRoutes);

// Error handling
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    //message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
