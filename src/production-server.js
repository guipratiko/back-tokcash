require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://tokcash.com.br',
  'https://www.tokcash.com.br',
];

// Adicionar FRONTEND_URL do .env se existir
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('⚠️ Origin bloqueado:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'tokcash'
}).then(() => {
  console.log('✅ MongoDB conectado:', process.env.MONGODB_DB);
}).catch(err => {
  console.error('❌ Erro MongoDB:', err.message);
  process.exit(1);
});

// Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  passwordResetToken: String,
  role: { type: String, default: 'user' },
  credits: { type: Number, default: 0 },
  cpf: String,
  phone: String,
  sexo: String,
}, { timestamps: true });

const PlanSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: String,
  priceBRL: Number,
  credits: Number,
  description: String,
  features: [String],
  isActive: Boolean,
}, { timestamps: true });

const PromptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inputBrief: Object,
  resultText: String,
  tags: [String],
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
}, { timestamps: true });

const VideoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  promptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prompt' },
  inputBrief: Object,
  resultText: String,
  tags: [String],
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  assets: Object,
}, { timestamps: true });

const TrendSchema = new mongoose.Schema({
  title: String,
  platform: String,
  keywords: [String],
  exampleHooks: [String],
}, { timestamps: true });

const CreditTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  amount: Number,
  reason: String,
  refId: String,
}, { timestamps: true });

// Models
const User = mongoose.model('User', UserSchema);
const Plan = mongoose.model('Plan', PlanSchema);
const Prompt = mongoose.model('Prompt', PromptSchema);
const Video = mongoose.model('Video', VideoSchema);
const Trend = mongoose.model('Trend', TrendSchema);
const CreditTransaction = mongoose.model('CreditTransaction', CreditTransactionSchema);

// Session storage (ainda em memória)
const sessions = new Map();

// Validação de senha forte
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Senha deve ter no mínimo 8 caracteres';
  }
  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra minúscula';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra maiúscula';
  }
  if (!/[0-9]/.test(password)) {
    return 'Senha deve conter pelo menos um número';
  }
  return null;
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, cpf, phone, sexo } = req.body;

    // Validações
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório' });
    }

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    // Validar força da senha
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      cpf,
      phone,
      sexo,
      role: 'user',
      credits: 0,
    });

    const token = 'token-' + Date.now();
    const userObj = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
    };
    sessions.set(token, userObj);

    console.log('✅ Usuário registrado:', email);

    res.cookie('accessToken', token, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.json({ user: userObj });
  } catch (error) {
    console.error('❌ Erro no registro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('\n🔐 === LOGIN ===');
    console.log('📧 Email:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ Email não encontrado');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      console.log('❌ Senha incorreta');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = 'token-' + Date.now();
    const userObj = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
    };
    sessions.set(token, userObj);

    console.log('✅ Login bem-sucedido:', user.name);

    res.cookie('accessToken', token, { httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.json({ user: userObj });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.accessToken;
  if (token) sessions.delete(token);
  res.clearCookie('accessToken');
  res.json({ message: 'Logout realizado' });
});

app.post('/api/auth/set-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password) {
      return res.status(400).json({ error: 'Token, email e senha são obrigatórios' });
    }

    // Validar força da senha
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (user.passwordResetToken !== token) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Atualizar senha e limpar token
    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    await user.save();

    console.log('✅ Senha definida para:', email);

    res.json({ success: true, message: 'Senha definida com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao definir senha:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    let user = sessions.get(token);

    if (!user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Atualizar créditos do banco
    const dbUser = await User.findById(user.id);
    if (dbUser) {
      user.credits = dbUser.credits;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Plans
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).lean();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Credits
app.get('/api/credits/balance', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const user = await User.findById(session.id);
    res.json({ balance: user ? user.credits : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/history', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const history = await CreditTransaction.find({ userId: session.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prompts
app.post('/api/prompts/generate', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    
    console.log('\n🔐 Verificando autenticação...');
    console.log('🍪 Token recebido:', token ? 'Sim' : 'Não');
    console.log('📋 Sessões ativas:', sessions.size);
    
    const session = sessions.get(token);
    
    if (!session) {
      console.log('❌ Sessão não encontrada');
      return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
    }
    
    console.log('✅ Usuário autenticado:', session.email);

    const { nicho, objetivo, cta, duracao, estilo, persona } = req.body;

    console.log('\n🚀 === GERANDO PROMPT ===');
    console.log('📝 Dados recebidos:', { nicho, objetivo, cta, duracao });
    
    // Validar campos obrigatórios
    if (!nicho || !objetivo) {
      console.log('❌ Campos obrigatórios faltando');
      return res.status(400).json({ error: 'Nicho e objetivo são obrigatórios' });
    }

    // Verificar e consumir créditos
    const user = await User.findById(session.id);
    const cost = parseInt(process.env.PROMPT_CREDIT_COST || '1', 10);
    
    if (user.credits < cost) {
      return res.status(400).json({ error: 'Saldo de créditos insuficiente' });
    }

    user.credits -= cost;
    await user.save();

    await CreditTransaction.create({
      userId: user._id,
      type: 'debit',
      amount: cost,
      reason: 'Geração de prompt',
    });

    console.log('💳 Créditos debitados:', cost);

    // Criar prompt com status "processing"
    const prompt = await Prompt.create({
      userId: user._id,
      inputBrief: { nicho, objetivo, cta, duracao, estilo, persona },
      resultText: '',
      tags: [nicho, estilo].filter(Boolean),
      status: 'processing',
    });

    console.log('💾 Prompt criado com ID:', prompt._id);

    // Enviar webhook assíncrono para Clerky API
    const clerkyUrl = process.env.CLERKY_PROMPT_WEBHOOK_URL;
    if (clerkyUrl) {
      const payload = {
        promptId: prompt._id.toString(),
        userId: user._id.toString(),
        prompt: objetivo,
        nicho,
        cta,
        duracao,
        estilo,
        persona,
        callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/webhooks/prompt-callback`,
      };

      console.log('📤 Enviando para Clerky/n8n...');
      console.log('🔗 URL:', clerkyUrl);
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      // Fire-and-forget (não esperamos resposta)
      fetch(clerkyUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'TokCash/1.0'
        },
        body: JSON.stringify(payload),
      }).catch((error) => {
        console.error('❌ Erro ao enviar webhook:', error.message);
        // Se falhar o envio, marcar como failed
        Prompt.findByIdAndUpdate(prompt._id, {
          status: 'failed',
          resultText: 'Erro ao enviar requisição para IA. Tente novamente.',
        }).catch(console.error);
      });
    } else {
      // Se não tiver URL configurada, gerar mock imediatamente
      console.log('🔄 Usando template mock...');
      const resultText = `🎯 Vídeo ${duracao || '30s'} - Nicho: ${nicho}

📌 Gancho (3s):
"Você sabia que ${nicho} pode mudar tudo?"

🎬 Desenvolvimento (20s):
${objetivo}

💰 CTA Final (7s):
${cta || 'Salve este vídeo!'}

✨ Estilo: ${estilo || 'Dinâmico'}
🎭 Persona: ${persona || 'Empreendedor'}`;
      
      prompt.resultText = resultText;
      prompt.status = 'completed';
      await prompt.save();
    }

    // Retorna imediatamente com status "processing" ou "completed"
    res.json({ prompt });
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prompts', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const prompts = await Prompt.find({ userId: session.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ prompts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/prompts/:id', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const prompt = await Prompt.findOne({
      _id: req.params.id,
      userId: session.id
    }).lean();
    
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/prompts/:id', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const prompt = await Prompt.findOne({
      _id: req.params.id,
      userId: session.id
    });
    
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    await Prompt.findByIdAndDelete(req.params.id);
    
    console.log('🗑️ Prompt deletado:', req.params.id);

    res.json({ success: true, message: 'Prompt deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Videos
app.post('/api/videos/generate', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    
    console.log('\n🎬 === GERANDO VÍDEO ===');
    console.log('🔐 Verificando autenticação...');
    console.log('🍪 Token recebido:', token ? 'Sim' : 'Não');
    console.log('📋 Sessões ativas:', sessions.size);
    
    const session = sessions.get(token);
    
    if (!session) {
      console.log('❌ Sessão não encontrada');
      return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
    }
    
    console.log('✅ Usuário autenticado:', session.email);

    const { nicho, objetivo, cta, duracao, estilo, persona } = req.body;

    console.log('\n🚀 === GERANDO VÍDEO ===');
    console.log('📝 Dados recebidos:', { nicho, objetivo, cta, duracao });
    
    // Validar campos obrigatórios
    if (!nicho || !objetivo) {
      console.log('❌ Campos obrigatórios faltando');
      return res.status(400).json({ error: 'Nicho e objetivo são obrigatórios' });
    }

    // Verificar e consumir créditos
    const user = await User.findById(session.id);
    const cost = parseInt(process.env.VIDEO_CREDIT_COST || '5', 10);
    
    if (user.credits < cost) {
      return res.status(400).json({ error: 'Saldo de créditos insuficiente' });
    }

    user.credits -= cost;
    await user.save();

    await CreditTransaction.create({
      userId: user._id,
      type: 'debit',
      amount: cost,
      reason: 'Geração de vídeo',
    });

    console.log('💳 Créditos debitados:', cost);

    // Criar vídeo com status "processing"
    const video = await Video.create({
      userId: user._id,
      promptId: req.body.promptId || undefined,
      inputBrief: { nicho, objetivo, cta, duracao, estilo, persona },
      resultText: '',
      tags: [nicho, estilo].filter(Boolean),
      status: 'processing',
      assets: {},
    });

    console.log('💾 Vídeo criado com ID:', video._id);

    // Enviar webhook assíncrono para Clerky API
    const clerkyUrl = process.env.CLERKY_VIDEO_WEBHOOK_URL;
    
    if (!clerkyUrl) {
      console.error('❌ CLERKY_VIDEO_WEBHOOK_URL não configurado');
      return res.status(500).json({ error: 'Webhook URL não configurada' });
    }
    
    const payload = {
      videoId: video._id.toString(),
      userId: user._id.toString(),
      prompt: objetivo,
      nicho,
      cta,
      duracao,
      estilo,
      persona,
      callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/webhooks/video-callback`,
    };

    console.log('📤 Enviando para Clerky/n8n...');
    console.log('🔗 URL:', clerkyUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    // Fire-and-forget (não esperamos resposta)
    fetch(clerkyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TokCash/1.0'
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error('❌ Erro ao enviar webhook:', error.message);
      // Se falhar o envio, marcar como failed
      Video.findByIdAndUpdate(video._id, {
        status: 'failed',
      }).catch(console.error);
    });

    // Retorna imediatamente com status "processing"
    res.json({ video });
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const videos = await Video.find({ userId: session.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const video = await Video.findOne({
      _id: req.params.id,
      userId: session.id
    }).lean();
    
    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json({ video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const video = await Video.findOne({
      _id: req.params.id,
      userId: session.id
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    await Video.findByIdAndDelete(req.params.id);
    
    console.log('🗑️ Vídeo deletado:', req.params.id);

    res.json({ success: true, message: 'Vídeo deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar vídeo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trends
app.get('/api/trends', async (req, res) => {
  try {
    const trends = await Trend.find()
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    res.json({ trends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhooks
app.post('/api/webhooks/incoming/n8n', async (req, res) => {
  try {
    console.log('📥 Webhook n8n recebido:', req.body);
    
    const { transactionId, name, email, amount, status, cpf, phone, credits, WEBHOOK_SECRET } = req.body;

    // Validar secret
    if (WEBHOOK_SECRET !== process.env.WEBHOOK_INCOMING_SECRET) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }

    if (status === 'paid' || status === 'approved') {
      let isNewUser = false;
      // Buscar ou criar usuário
      let user = await User.findOne({ email });

      if (!user) {
        isNewUser = true;
        // Gerar token para definição de senha
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tempPassword = Math.random().toString(36).slice(-8);
        
        user = await User.create({
          name,
          email,
          passwordHash: await bcrypt.hash(tempPassword, 10),
          passwordResetToken: resetToken,
          cpf,
          phone,
          role: 'user',
          credits: 0,
        });
        console.log('✅ Usuário criado:', email);
      }

      // Creditar
      user.credits += credits;
      await user.save();

      await CreditTransaction.create({
        userId: user._id,
        type: 'credit',
        amount: credits,
        reason: `Pagamento aprovado - TXN ${transactionId}`,
        refId: transactionId,
      });

      console.log('✅ Créditos adicionados:', credits, 'para', email);

      // Se for novo usuário, retornar URL de definição de senha
      if (isNewUser && user.passwordResetToken) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const setPasswordUrl = `${frontendUrl}/auth/set-password?token=${user.passwordResetToken}&email=${encodeURIComponent(email)}`;
        
        return res.json({ 
          success: true,
          setPasswordUrl,
          message: 'Usuário criado e créditos adicionados. URL de definição de senha incluída.'
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/prompt-callback', async (req, res) => {
  try {
    console.log('\n📥 === CALLBACK DE PROMPT RECEBIDO ===');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { promptId, result, status, WEBHOOK_SECRET } = req.body;

    // Validar secret (opcional)
    const secret = process.env.WEBHOOK_PROMPT_CALLBACK_SECRET;
    if (secret && WEBHOOK_SECRET !== secret) {
      console.log('❌ Secret inválido');
      return res.status(401).json({ error: 'Secret inválido' });
    }

    if (!promptId || !result) {
      console.log('❌ promptId ou result faltando');
      return res.status(400).json({ error: 'promptId e result são obrigatórios' });
    }

    // Buscar prompt no banco usando promptId
    const prompt = await Prompt.findById(promptId);

    if (!prompt) {
      console.log('❌ Prompt não encontrado:', promptId);
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    console.log('✅ Prompt encontrado:', promptId);
    console.log('👤 UserId:', prompt.userId);

    // Atualizar prompt com resultado
    prompt.resultText = result;
    prompt.status = status === 'failed' ? 'failed' : 'completed';
    await prompt.save();

    console.log('✅ Prompt atualizado com sucesso!');
    console.log('📊 Status:', prompt.status);
    console.log('📄 Preview:', result.substring(0, 100) + '...');

    res.json({ success: true, message: 'Prompt atualizado' });
  } catch (error) {
    console.error('❌ Erro no callback:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/video-callback', async (req, res) => {
  try {
    console.log('\n📥 === CALLBACK DE VÍDEO RECEBIDO ===');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { videoId, result, status, WEBHOOK_SECRET } = req.body;

    // Validar secret (opcional)
    const secret = process.env.WEBHOOK_VIDEO_CALLBACK_SECRET;
    if (secret && WEBHOOK_SECRET !== secret) {
      console.log('❌ Secret inválido');
      return res.status(401).json({ error: 'Secret inválido' });
    }

    if (!videoId) {
      console.log('❌ videoId faltando');
      return res.status(400).json({ error: 'videoId é obrigatório' });
    }

    // Buscar vídeo no banco usando videoId
    const video = await Video.findById(videoId);

    if (!video) {
      console.log('❌ Vídeo não encontrado:', videoId);
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    console.log('✅ Vídeo encontrado:', videoId);
    console.log('👤 UserId:', video.userId);

    // Atualizar vídeo com resultado
    video.status = status === 'failed' ? 'failed' : 'completed';
    
    // Se vieram assets, atualizar
    if (req.body.assets) {
      video.assets = req.body.assets;
    }
    
    // Se vier result, salvar
    if (result) {
      video.resultText = result;
    }
    
    await video.save();

    console.log('✅ Vídeo atualizado com sucesso!');
    console.log('📊 Status:', video.status);

    res.json({ success: true, message: 'Vídeo atualizado' });
  } catch (error) {
    console.error('❌ Erro no callback:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🚀 TokCash Backend PRODUÇÃO (MongoDB) rodando em http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_DB}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`\n👤 Login admin: admin@tokcash.com / Admin@123`);
  console.log(`📝 Ou crie nova conta no registro\n`);
});

