const app = require('../app');

module.exports = async (req, res) => {
  try {
    await app.connectDatabase();
    return app(req, res);
  } catch (error) {
    return res.status(500).json({
      message: 'database connection failed',
      error: error.message,
    });
  }
};
