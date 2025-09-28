const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/home', (req, res) => {
  res.send('Konnichiwa!');
});

app.get('/api/analyze', async (req, res) => {
  try {
    const response = await fetch("https://genyoutube.online/mates/en/analyze/ajax?retry=undefined&platform=youtube", {
      method: "POST",
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        "Referer": "https://genyoutube.online/en1/"
      },
      body: "url=https%3A%2F%2Fyoutube.com%2Fshorts%2F0I5wc6Clqww%3Fsi%3D2zYedFkpW7QbZXAS&ajax=1&lang=en"
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Remote request failed' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => console.log(`API running on PORT: ${PORT}`));
