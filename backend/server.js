const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/analyze', upload.array('files', 10), async (req, res) => {
  try {
    const { kwp, year, itype, price, notes } = req.body;
    const imageFiles = req.files?.filter(f => f.mimetype.startsWith('image/')) || [];

    const contents = imageFiles.slice(0, 4).map(f => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: f.mimetype,
        data: f.buffer.toString('base64')
      }
    }));

    const prompt = `Είσαι ειδικός μηχανικός φωτοβολταϊκών. Αναλύεις εναέριο υλικό drone.

Εγκατάσταση: ${kwp}kWp, ${itype}, έτος ${year}, τιμή €${price}/kWh, αρχεία: ${imageFiles.length} φωτογραφίες${notes ? ', σημείωση: '+notes : ''}.

${contents.length ? 'Αναλύεις τις επισυναπτόμενες φωτογραφίες.' : 'Δεν υπάρχουν φωτογραφίες — δημιούργησε ρεαλιστική αναφορά για τυπική εγκατάσταση '+kwp+'kWp.'}

Απάντησε ΜΟΝΟ σε JSON χωρίς markdown:
{"summary":"2-3 προτάσεις","performance_loss_pct":18,"issues":[{"title":"τίτλος","severity":"high|medium|low","description":"περιγραφή","panels_affected":3}],"annual_loss_eur":420,"repair_cost_eur":180,"payback_months":5,"health_score":72}`;

    const messages = [{ role: 'user', content: contents.length ? [...contents, { type: 'text', text: prompt }] : prompt }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages})
    });

    if (!response.ok) {
  const errText = await response.text();
  throw new Error('Anthropic API error: ' + response.status + ' — ' + errText);
}
    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    const result = JSON.parse(text);
    res.json({ success: true, report: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SolarScan τρέχει στο http://localhost:${PORT}`));