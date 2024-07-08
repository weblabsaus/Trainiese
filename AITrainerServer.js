const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_trainer';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define AI Knowledge schema
const AIKnowledgeSchema = new mongoose.Schema({
  word: String,
  definition: String
});

const AIKnowledge = mongoose.model('AIKnowledge', AIKnowledgeSchema);

app.use(cors());
app.use(express.json());

// Fetch definition from external API
async function fetchDefinition(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0 && data[0].meanings && data[0].meanings.length > 0) {
      return data[0].meanings[0].definitions[0].definition;
    }
    return null;
  } catch (error) {
    console.error('Error fetching definition:', error);
    return null;
  }
}

// Learn word
app.post('/learn', async (req, res) => {
  const { word } = req.body;
  let knowledgeEntry = await AIKnowledge.findOne({ word });

  if (!knowledgeEntry) {
    const definition = await fetchDefinition(word);
    if (definition) {
      knowledgeEntry = new AIKnowledge({ word, definition });
      await knowledgeEntry.save();
    }
  }

  res.json(knowledgeEntry || { word, definition: null });
});

// Get AI response
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const words = message.split(/\s+/);
  let response = '';

  for (const word of words) {
    let knowledgeEntry = await AIKnowledge.findOne({ word });
    if (knowledgeEntry) {
      response += `${word}: ${knowledgeEntry.definition}. `;
    } else {
      const definition = await fetchDefinition(word);
      if (definition) {
        knowledgeEntry = new AIKnowledge({ word, definition });
        await knowledgeEntry.save();
        response += `I just learned about "${word}": ${definition}. `;
      } else {
        response += `I don't know about "${word}". `;
      }
    }
  }

  res.json({ response: response || "I'm still learning. Can you tell me more?" });
});

// Train AI
app.post('/train', async (req, res) => {
  const { input } = req.body;
  const words = input.split(/\s+/);
  let learnedWords = [];

  for (const word of words) {
    let knowledgeEntry = await AIKnowledge.findOne({ word });
    if (!knowledgeEntry) {
      const definition = await fetchDefinition(word);
      if (definition) {
        knowledgeEntry = new AIKnowledge({ word, definition });
        await knowledgeEntry.save();
        learnedWords.push(word);
      }
    }
  }

  res.json({ message: `AI has been trained with: ${learnedWords.join(', ')}` });
});

app.listen(port, () => {
  console.log(`AITrainerServer listening at http://localhost:${port}`);
});