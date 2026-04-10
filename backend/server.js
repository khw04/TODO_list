require('dotenv').config();
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const server = express();

server.use('/api', app);

app
  .connectDatabase()
  .then(() => {
    console.log('MongoDB connected');

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed');
    console.error(error);
    process.exit(1);
  });
