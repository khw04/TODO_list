require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

app
  .connectDatabase()
  .then(() => {
    console.log('MongoDB connected');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed');
    console.error(error);
    process.exit(1);
  });
