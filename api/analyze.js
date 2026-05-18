export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body;

  const prompt = `
You are an advanced agronomic AI model specialising in wheat physiology, soil science, and drought stress research.
Your task is to perform a comprehensive, science-based evaluation of wheat drought resistance from real sensor data.

Do NOT use simple threshold rules. Instead, reason holistically about how each parameter interacts with the others
to affect the plant's ability to withstand drought — consider osmotic stress, stomatal conductance, nutrient uptake
efficiency under water deficit, soil structural health, ion toxicity, and root zone conditions.

Sensor readings from the field:
- Soil Temperature:   ${data.t   ?? "N/A"} °C
- Soil Moisture:      ${data.m   ?? "N/A"} %
- Soil pH:            ${data.ph  ?? "N/A"}
- Electrical Conductivity (EC): ${data.ec ?? "N/A"} µS/cm
- Nitrogen (N):       ${data.n   ?? "N/A"} mg/kg
- Phosphorus (P):     ${data.p   ?? "N/A"} mg/kg
- Potassium (K):      ${data.k   ?? "N/A"} mg/kg
- Humic Acid Index:   ${data.hum ?? "N/A"}
- Soil Health Score:  ${data.shs ?? "N/A"}

Score methodology:
- 80–100: Excellent. Strong osmotic adjustment, adequate K, sufficient moisture buffering.
- 60–79: Good but one or two factors limiting. Can tolerate short dry spells.
- 40–59: Moderate stress. Multiple interacting deficiencies reduce tolerance.
- 20–39: High stress. Severe limiting factors, likely showing symptoms.
- 0–19: Critical. Immediate intervention required.

Level rules (strict):
- score >= 70 → "High"
- score 40–69 → "Moderate"
- score < 40  → "Low"

Return ONLY valid JSON, no markdown, no code fences:
{
  "score": <integer 0-100>,
  "level": "<High|Moderate|Low>",
  "tempStatus": "<short label with emoji>",
  "waterStatus": "<short label with emoji>",
  "plantStatus": "<short label with emoji>",
  "analysis": [
    "<temperature finding>",
    "<moisture + EC interaction finding>",
    "<pH and nutrient availability finding>",
    "<salinity/osmotic stress finding>",
    "<NPK balance + K stomatal control + SHS buffering finding>"
  ],
  "recommendation": "<2-3 sentences of specific actionable advice>"
}
`.trim();

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(502).json({ error: err?.error?.message || "Gemini error" });
    }

    const json = await geminiRes.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/gi, "").trim();

    res.status(200).send(clean);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}