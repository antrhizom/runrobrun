export default async function handler(req, res) {
  // Nur POST erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, difficulty, questionCount } = req.body;

  // Validierung
  if (!topic || !difficulty || !questionCount) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Du bist ein Lehrer der Quiz-Fragen erstellt. Antworte NUR mit einem JSON-Objekt, ohne zusätzlichen Text."
          },
          { 
            role: "user", 
            content: `Erstelle ${questionCount} Quiz-Fragen zum Thema "${topic}" mit Schwierigkeitsgrad "${difficulty}".

Format (genau so):
{
  "questions": [
    {
      "question": "Fragentext",
      "answers": ["Antwort 1", "Antwort 2", "Antwort 3", "Antwort 4"],
      "correct": 0
    }
  ]
}

Regeln:
- Genau ${questionCount} Fragen
- Jede Frage hat 4 Antworten
- "correct" ist der Index (0-3)
- Altersgerecht
- Schwierigkeit: ${difficulty}

Antworte NUR mit dem JSON-Objekt!`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI Error:', error);
      return res.status(500).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    let responseText = data.choices[0].message.content;
    
    // Remove markdown code blocks
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsedData = JSON.parse(responseText);
    
    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to generate questions' });
  }
}