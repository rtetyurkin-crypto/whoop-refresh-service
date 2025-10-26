const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'whoop-token-refresh' });
});

// Refresh token endpoint
app.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token, client_id, client_secret } = req.body;

    if (!refresh_token || !client_id || !client_secret) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Build form data
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client_id,
      client_secret: client_secret,
      scope: 'offline',
      refresh_token: refresh_token
    });

    // Call Whoop API
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});