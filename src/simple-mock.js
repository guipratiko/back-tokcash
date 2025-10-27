require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Storage em memória
const users = new Map();
const prompts = [];
const videos = [];
const sessions = new Map();

// Criar usuário de teste padrão
users.set('teste@tokcash.com', {
  id: 'test-user-123',
  name: 'Usuário Teste',
  email: 'teste@tokcash.com',
  password: '123456',
  role: 'user',
  credits: 15,
});

// Plans mock
const plans = [
  {
    _id: '1',
    code: 'START',
    name: 'START CASH',
    priceBRL: 97,
    credits: 15,
    description: 'Comece sua jornada com IA e gere seus primeiros vídeos virais.',
    features: [
      'Geração automática de vídeos curtos e engajantes',
      'Tendências semanais do TikTok',
      'Biblioteca de prompts virais prontos',
      'Ideal para iniciar',
      'Ganhos médios até R$3.900/mês',
    ],
    isActive: true,
  },
  {
    _id: '2',
    code: 'PRO',
    name: 'VIRAL PRO',
    priceBRL: 197,
    credits: 30,
    description: 'Transforme vídeos em lucro com IA.',
    features: [
      'Roteiro, voz, legenda e vídeo pronto',
      'Edição automática e otimização de performance',
      'Relatórios de engajamento e monetização',
      '⭐ Mais popular',
      'Ganhos médios até R$10.000/mês',
    ],
    isActive: true,
  },
  {
    _id: '3',
    code: 'INFINITY',
    name: 'INFINITY CASH',
    priceBRL: 497,
    credits: 100,
    description: '🚀 Poder máximo, escala total.',
    features: [
      '100 créditos',
      'Consultoria rápida com especialista Tok Cash',
      'Suporte prioritário e acesso antecipado às novas IAs',
      'Benefícios exclusivos da comunidade',
      'Ganhos médios R$30.000+/mês',
    ],
    isActive: true,
  },
];

// Trends mock
const trends = [
  {
    _id: '1',
    title: 'Storytelling Emocional',
    platform: 'tiktok',
    keywords: ['storytime', 'vida real', 'superação', 'motivação'],
    exampleHooks: [
      'Essa história mudou minha vida...',
      'Ninguém acredita quando eu conto isso',
      'Eu tinha apenas 3 dias para decidir...',
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: '2',
    title: 'Dicas Rápidas de Produtividade',
    platform: 'shorts',
    keywords: ['produtividade', 'hack', 'rotina', 'organização'],
    exampleHooks: [
      'Esse truque triplicou minha produtividade',
      '3 apps que mudaram minha vida',
      'Como eu organizo 10h de trabalho em 4h',
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: '3',
    title: 'Antes & Depois Impactante',
    platform: 'reels',
    keywords: ['transformação', 'resultado', 'progresso', 'evolução'],
    exampleHooks: [
      'De 0 a 10k em 30 dias',
      'Veja o que aconteceu em 1 semana',
      'Ninguém acreditou nessa transformação',
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: '4',
    title: 'Segredos de Nicho',
    platform: 'tiktok',
    keywords: ['segredo', 'bastidores', 'revelação', 'exclusivo'],
    exampleHooks: [
      'Isso ninguém te conta sobre...',
      'O segredo dos profissionais é...',
      'Por que isso é escondido de você',
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: '5',
    title: 'Tutorial Express',
    platform: 'shorts',
    keywords: ['tutorial', 'passo a passo', 'aprender', 'fazer'],
    exampleHooks: [
      'Como fazer em 60 segundos',
      'Tutorial completo e gratuito',
      'Aprenda isso em menos de 1 minuto',
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: '6',
    title: 'Polêmica Construtiva',
    platform: 'reels',
    keywords: ['opinião', 'verdade', 'realidade', 'fato'],
    exampleHooks: [
      'Vou falar o que ninguém fala',
      'A verdade que você precisa ouvir',
      'Desculpa, mas isso é mentira',
    ],
    updatedAt: new Date().toISOString(),
  },
];

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (users.has(email)) {
    return res.status(400).json({ error: 'Email já cadastrado' });
  }

  const user = {
    id: Date.now().toString(),
    name,
    email,
    role: 'user',
    credits: 15,
  };

  users.set(email, { ...user, password });
  const token = 'token-' + Date.now();
  sessions.set(token, user);

  res.cookie('accessToken', token, { httpOnly: true, maxAge: 15 * 60 * 1000 });
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('\n🔐 === TENTATIVA DE LOGIN ===');
  console.log('📧 Email:', email);
  console.log('👥 Usuários cadastrados:', Array.from(users.keys()));
  
  const userData = users.get(email);
  
  if (!userData) {
    console.log('❌ Email não encontrado');
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  
  if (userData.password !== password) {
    console.log('❌ Senha incorreta');
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const user = { ...userData };
  delete user.password;

  const token = 'token-' + Date.now();
  sessions.set(token, user);

  console.log('✅ Login bem-sucedido!');
  console.log('👤 Usuário:', user.name);

  res.cookie('accessToken', token, { httpOnly: true, maxAge: 15 * 60 * 1000 });
  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.accessToken;
  if (token) sessions.delete(token);
  res.clearCookie('accessToken');
  res.json({ message: 'Logout realizado' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.accessToken;
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  res.json({ user });
});

// Plans
app.get('/api/plans', (req, res) => {
  res.json(plans);
});

// Credits
app.get('/api/credits/balance', (req, res) => {
  res.json({ balance: 15 });
});

app.get('/api/credits/history', (req, res) => {
  res.json({ history: [] });
});

// Prompts
app.post('/api/prompts/generate', async (req, res) => {
  const { nicho, objetivo, cta, duracao, estilo, persona } = req.body;
  
  console.log('\n🚀 === GERANDO PROMPT (ASSÍNCRONO) ===');
  console.log('📝 Dados recebidos:', { nicho, objetivo, duracao });
  
  // Criar prompt com status "processing"
  const prompt = {
    _id: Date.now().toString(),
    inputBrief: req.body,
    resultText: '',
    tags: [nicho, estilo].filter(Boolean),
    status: 'processing',
    createdAt: new Date().toISOString(),
  };
  prompts.unshift(prompt);

  // Enviar webhook assíncrono para Clerky API (n8n)
  const clerkyUrl = process.env.CLERKY_PROMPT_WEBHOOK_URL;
  
  if (clerkyUrl) {
    const payload = {
      promptId: prompt._id,
      prompt: objetivo,
      nicho,
      cta,
      duracao,
      estilo,
      persona,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/webhooks/prompt-callback`,
    };

    console.log('📤 Enviando webhook para Clerky/n8n (assíncrono)...');
    console.log('🔗 URL:', clerkyUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    // Fire-and-forget (não espera resposta)
    fetch(clerkyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TokCash/1.0'
      },
      body: JSON.stringify(payload),
    }).then(response => {
      console.log('📡 Webhook enviado! Status:', response.status);
    }).catch(error => {
      console.error('❌ Erro ao enviar webhook:', error.message);
      // Marcar prompt como failed
      const failedPrompt = prompts.find(p => p._id === prompt._id);
      if (failedPrompt) {
        failedPrompt.status = 'failed';
        failedPrompt.resultText = 'Erro ao enviar requisição para IA. Tente novamente.';
      }
    });
  } else {
    console.log('⚠️ CLERKY_PROMPT_WEBHOOK_URL não configurada, gerando mock imediatamente');
    // Se não tiver URL configurada, gerar mock imediatamente
    prompt.resultText = `🎯 Vídeo ${duracao || '30s'} - Nicho: ${nicho}

📌 Gancho (3s):
"Você sabia que ${nicho} pode mudar tudo?"

🎬 Desenvolvimento (20s):
${objetivo}

💰 CTA Final (7s):
${cta || 'Salve este vídeo!'}

✨ Estilo: ${estilo || 'Dinâmico'}
🎭 Persona: ${persona || 'Empreendedor'}`;
    prompt.status = 'completed';
  }

  console.log('✅ Retornando prompt com status:', prompt.status);
  res.json({ prompt });
});

app.get('/api/prompts', (req, res) => {
  res.json({ prompts });
});

app.get('/api/prompts/:id', (req, res) => {
  const prompt = prompts.find(p => p._id === req.params.id);
  if (!prompt) {
    return res.status(404).json({ error: 'Prompt não encontrado' });
  }
  res.json({ prompt });
});

app.delete('/api/prompts/:id', (req, res) => {
  const index = prompts.findIndex(p => p._id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Prompt não encontrado' });
  }
  prompts.splice(index, 1);
  console.log('🗑️ Prompt deletado:', req.params.id);
  res.json({ success: true, message: 'Prompt deletado com sucesso' });
});

// Videos
app.post('/api/videos/generate', (req, res) => {
  const video = {
    _id: Date.now().toString(),
    status: 'queued',
    assets: {},
    createdAt: new Date().toISOString(),
  };
  videos.unshift(video);
  
  setTimeout(() => {
    video.status = 'processing';
  }, 2000);
  
  setTimeout(() => {
    video.status = 'ready';
    video.assets = { videoUrl: 'https://example.com/video.mp4' };
  }, 10000);
  
  res.json({ video });
});

app.get('/api/videos', (req, res) => {
  res.json({ videos });
});

// Trends
app.get('/api/trends', (req, res) => {
  res.json({ trends });
});

// Webhooks
app.post('/api/webhooks/incoming/n8n', (req, res) => {
  console.log('📥 Webhook recebido:', req.body);
  res.json({ success: true });
});

app.post('/api/webhooks/prompt-callback', (req, res) => {
  const { promptId, result, status, WEBHOOK_SECRET } = req.body;
  
  console.log('\n📨 === CALLBACK DE PROMPT RECEBIDO ===');
  console.log('🆔 Prompt ID:', promptId, '(tipo:', typeof promptId, ')');
  console.log('📄 Resultado recebido:', result ? result.substring(0, 100) + '...' : 'vazio');
  console.log('📊 Status:', status);
  
  // Validar WEBHOOK_SECRET se configurado
  const secret = process.env.WEBHOOK_PROMPT_CALLBACK_SECRET;
  if (secret && WEBHOOK_SECRET !== secret) {
    console.log('❌ Secret inválido!');
    return res.status(400).json({ error: 'Secret inválido' });
  }
  
  // Converter promptId para string para garantir comparação correta
  const promptIdStr = String(promptId);
  
  // Debug: mostrar todos os IDs disponíveis
  console.log('📋 IDs disponíveis:', prompts.map(p => `${p._id} (${typeof p._id})`));
  
  // Buscar prompt no array (comparando como string)
  const prompt = prompts.find(p => String(p._id) === promptIdStr);
  
  if (!prompt) {
    console.log('❌ Prompt não encontrado:', promptIdStr);
    console.log('📝 Total de prompts:', prompts.length);
    return res.status(404).json({ error: 'Prompt não encontrado' });
  }
  
  // Atualizar prompt com resultado
  prompt.resultText = result;
  prompt.status = status === 'failed' ? 'failed' : 'completed';
  
  console.log('✅ Prompt atualizado com sucesso!');
  console.log('📝 Novo status:', prompt.status);
  console.log('📄 Texto salvo:', prompt.resultText ? 'Sim' : 'Não');
  
  res.json({ success: true, message: 'Prompt atualizado' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 TokCash Backend MOCK rodando em http://localhost:${PORT}`);
  console.log(`📊 Modo: MOCK SIMPLES (Express puro)`);
  console.log(`🔗 Frontend esperado em ${process.env.FRONTEND_URL}`);
  console.log(`\n👤 Usuário de teste criado:`);
  console.log(`   Email: teste@tokcash.com`);
  console.log(`   Senha: 123456`);
  console.log(`   Créditos: 15\n`);
});

