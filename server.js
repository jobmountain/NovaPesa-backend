// ============================================================
// NovaPesa AI Money Coach — Backend API
// Production-ready for Render deployment
// ============================================================

const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const app = express()

// ── 1. PORT — dynamic for Render ──────────────────────────
const PORT = process.env.PORT || 3000

// ── 2. OPENAI — key from environment only, never hardcoded ─
const OpenAI = require('openai')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // set in Render dashboard
})

// ── 3. CORS — only allow GitHub Pages frontend ────────────
app.use(cors({
  origin: 'https://jobmountain.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))

// ── 4. BODY PARSER ────────────────────────────────────────
app.use(express.json({ limit: '10kb' }))

// ── 5. RATE LIMITING — prevent abuse ──────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 requests per IP
  message: { error: 'Too many requests. Please wait and try again.' }
})

// ── 6. HEALTH CHECK ───────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'NovaPesa AI Money Coach API',
    version: '1.0.0'
  })
})

// ── 7. POST /analyze ──────────────────────────────────────
// Frontend sends user financial data → returns AI analysis
// Response format: { result: "..." } — matches frontend expectation
app.post('/analyze', limiter, async (req, res) => {
  try {
    const {
      name,
      income,
      expenses,
      savings,
      debt,
      investing,
      goals,
      knowledge,
      challenge,
      novaScore,
      subScores
    } = req.body

    // Validate required fields
    if (income === undefined || income === null ||
        expenses === undefined || expenses === null) {
      return res.status(400).json({
        error: 'Missing required fields: income and expenses'
      })
    }

    // Map indices to readable labels
    const labels = {
      income:    ['Under KES 10,000','KES 10,000–30,000','KES 30,000–70,000','KES 70,000–150,000','Over KES 150,000'],
      expenses:  ['Less than 50% of income','50–70% of income','70–90% of income','Almost all of it','More than I earn'],
      savings:   ['No savings yet','Under KES 5,000','KES 5,000–20,000','KES 20,000–100,000','Over KES 100,000'],
      debt:      ['No debt at all','Small personal loan','Credit card debt','Multiple loans','Significant debt burden'],
      investing: ['Not investing','Occasionally','Monthly consistently','Multiple assets','Active trader'],
      knowledge: ['Complete beginner','Basic knowledge','Moderate understanding','Quite knowledgeable','Expert level']
    }

    // Build personalized AI prompt
    const prompt = `You are Nova, an expert AI financial advisor for NovaPesa — a fintech platform for Kenya and the Global South.

Analyze this user's financial situation and provide specific, personalized advice.

USER PROFILE:
- Name: ${name || 'User'}
- Monthly Income: ${labels.income[income] || income}
- Monthly Expenses: ${labels.expenses[expenses] || expenses}
- Current Savings: ${labels.savings[savings] || savings}
- Debt Situation: ${labels.debt[debt] || debt}
- Investments: ${labels.investing[investing] || investing}
- Financial Knowledge: ${labels.knowledge[knowledge] || knowledge}
- Goals: ${Array.isArray(goals) ? goals.join(', ') : (goals || 'Not specified')}
- Biggest Challenge: ${challenge || 'Not specified'}
- NovaScore: ${novaScore || 0}/100
- Savings Score: ${subScores?.savings || 0}/100
- Spending Score: ${subScores?.spending || 0}/100
- Investment Score: ${subScores?.investment || 0}/100
- Knowledge Score: ${subScores?.knowledge || 0}/100

Please provide:
1. 💡 A brief personal financial assessment (2–3 sentences)
2. 💪 Top 3 strengths
3. 🎯 Top 3 areas to improve
4. ✅ 3 specific actions to take THIS WEEK (with KES amounts)
5. 🚀 A motivating closing message

Rules:
- Be specific — no generic advice
- Use KES amounts
- Be honest but encouraging
- Max 350 words
- Address them as "${name || 'friend'}" directly`

    // Call OpenAI — using gpt-4o-mini (faster + cheaper for MVP)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Nova, a professional AI financial advisor for NovaPesa. Give personalized, practical financial advice for people in Kenya. Always be encouraging, specific, and actionable.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7
    })

    const aiText = completion.choices[0]?.message?.content

    if (!aiText) {
      return res.status(500).json({ error: 'No response from AI. Please try again.' })
    }

    // ✅ Response format matches frontend: result.result
    res.json({ result: aiText })

  } catch (error) {
    // ✅ No sensitive data logged
    console.error('Analyze error:', error.message)

    if (error.status === 429) {
      return res.status(429).json({ error: 'AI is busy. Please try again in a moment.' })
    }
    if (error.status === 401) {
      return res.status(500).json({ error: 'AI configuration error. Contact support.' })
    }

    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

// ── 8. POST /chat ─────────────────────────────────────────
// Nova AI chat — uses user context for personalized responses
app.post('/chat', limiter, async (req, res) => {
  try {
    const { message, userContext, chatHistory } = req.body

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const system = `You are Nova, the personal AI financial advisor for NovaPesa.

USER:
- Name: ${userContext?.name || 'User'}
- NovaScore: ${userContext?.score || 0}/100
- Level: ${userContext?.level?.label || 'Beginner'}
- Savings Score: ${userContext?.sub?.savings || 0}/100
- Spending Score: ${userContext?.sub?.spending || 0}/100
- Investment Score: ${userContext?.sub?.investment || 0}/100
- Knowledge Score: ${userContext?.sub?.knowledge || 0}/100

Rules:
- Reference their actual scores in your advice
- Use KES amounts for Kenya
- Be encouraging and concise (max 120 words)
- Give actionable advice only`

    const messages = [
      { role: 'system', content: system },
      ...(chatHistory || []).slice(-6).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: String(m.content).replace(/<[^>]*>/g, '')
      })),
      { role: 'user', content: message.trim() }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 250,
      temperature: 0.7
    })

    const reply = completion.choices[0]?.message?.content

    // ✅ Frontend uses result.reply for chat
    res.json({ result: reply })

  } catch (error) {
    console.error('Chat error:', error.message)
    res.status(500).json({ error: 'Nova AI is temporarily unavailable. Please try again.' })
  }
})

// ── 9. POST /plan ─────────────────────────────────────────
// AI-generated personalized 90-Day Financial Plan
app.post('/plan', limiter, async (req, res) => {
  try {
    const { userProfile, novaScore, subScores } = req.body

    const weakest = Object.entries(subScores || {})
      .sort((a, b) => a[1] - b[1])[0]?.[0] || 'savings'

    const prompt = `You are Nova, AI financial advisor for NovaPesa.

Create a personalized 90-Day Financial Plan.

USER:
- NovaScore: ${novaScore || 0}/100
- Weakest area: ${weakest}
- Income: ${userProfile?.income || 'Not specified'}
- Challenge: ${userProfile?.challenge || 'Not specified'}
- Goals: ${userProfile?.goals || 'Not specified'}

Return EXACTLY this format:
MONTH 1 - BUILD YOUR FOUNDATION:
- [specific task with KES amount]
- [specific task]
- [specific task]
- [specific task]
- [specific task]

MONTH 2 - START GROWING:
- [specific task with KES amount]
- [specific task]
- [specific task]
- [specific task]
- [specific task]

MONTH 3 - BUILD MOMENTUM:
- [specific task with KES amount]
- [specific task]
- [specific task]
- [specific task]
- [specific task]

Make every task specific and achievable in Kenya.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a financial advisor creating 90-day plans for people in Kenya.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.6
    })

    res.json({ result: completion.choices[0]?.message?.content })

  } catch (error) {
    console.error('Plan error:', error.message)
    res.status(500).json({ error: 'Could not generate plan. Please try again.' })
  }
})

// ── 10. GLOBAL ERROR HANDLER ──────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── 11. 404 ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// ── START ─────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NovaPesa API on port ${PORT}`)
  console.log(`🔑 OpenAI key: ${process.env.OPENAI_API_KEY ? 'SET ✅' : 'MISSING ❌'}`)
})

module.exports = app
