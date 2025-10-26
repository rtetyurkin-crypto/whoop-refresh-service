const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'whoop-refresh' });
});

// Auto refresh
app.get('/auto-refresh', async (req, res) => {
  try {
    console.log('Starting auto-refresh...');

    // 1. Read token from Supabase
    const fetchResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/whoop_tokens?user_id=eq.20260404&select=*`,
      {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      }
    );

    const tokenData = await fetchResponse.json();
    
    if (!fetchResponse.ok || !tokenData[0]) {
      console.error('Error fetching token:', tokenData);
      return res.status(500).json({ error: 'Failed to fetch token from database' });
    }

    const currentToken = tokenData[0];
    console.log('Token fetched from Supabase');

    // 2. Refresh via Whoop API
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      scope: 'offline',
      refresh_token: currentToken.refresh_token
    });

    const whoopResponse = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const newTokens = await whoopResponse.json();

    if (!whoopResponse.ok) {
      console.error('Whoop API error:', newTokens);
      return res.status(whoopResponse.status).json(newTokens);
    }

    console.log('New tokens received from Whoop');

    // 3. Save back to Supabase
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    const updateResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/whoop_tokens?user_id=eq.20260404`,
      {
        method: 'PATCH',
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      console.error('Error updating Supabase:', errorData);
      return res.status(500).json({ error: 'Failed to update database' });
    }

    console.log('Tokens saved to Supabase');

    res.json({ 
      success: true, 
      message: 'Tokens refreshed successfully',
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('Auto-refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
