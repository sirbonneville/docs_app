const express = require('express');
const router = express.Router();
const askController = require('../controllers/askController');

// Define routes
router.post('/ask', askController.handleQuery);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;