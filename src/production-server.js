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
  promptCredits: { type: Number, default: 0 },
  videoCredits: { type: Number, default: 0 },
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

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  userName: String,
  userPhone: String,
  userCpf: String,
  transactionId: String,
  status: String, // approved, pending, cancelled
  amount: Number, // Valor recebido
  evento: String, // paid, pending, cancelled
  productType: String, // monthly, videoUpsell, promptUpsell
}, { timestamps: true });

// Models
const User = mongoose.model('User', UserSchema);
const Plan = mongoose.model('Plan', PlanSchema);
const Prompt = mongoose.model('Prompt', PromptSchema);
const Video = mongoose.model('Video', VideoSchema);
const Trend = mongoose.model('Trend', TrendSchema);
const CreditTransaction = mongoose.model('CreditTransaction', CreditTransactionSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

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
      promptCredits: 0,
      videoCredits: 0,
    });

    const token = 'token-' + Date.now();
    const userObj = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
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

app.put('/api/auth/update-profile', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);

    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { name, phone } = req.body;

    // Atualizar usuário no banco
    const user = await User.findByIdAndUpdate(
      session.id,
      { 
        name: name || undefined,
        phone: phone || undefined,
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualizar sessão
    sessions.set(token, {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    });

    console.log('✅ Perfil atualizado:', user.email);

    res.json({ 
      success: true, 
      message: 'Perfil atualizado com sucesso',
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone,
      }
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/change-password', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);

    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórios' });
    }

    // Validar força da nova senha
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Buscar usuário
    const user = await User.findById(session.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Atualizar senha
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log('✅ Senha alterada para:', user.email);

    res.json({ 
      success: true, 
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error);
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

    // Atualizar dados do banco
    const dbUser = await User.findById(user.id);
    if (dbUser) {
      // Sessão não precisa dos créditos, são buscados separadamente
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
    if (!user) {
      return res.json({ 
        promptCredits: 0,
        videoCredits: 0
      });
    }

    res.json({ 
      promptCredits: user.promptCredits || 0,
      videoCredits: user.videoCredits || 0
    });
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

    const { nicho, objetivo, cta, duracao, estilo, persona, estiloVoz, idioma, tomVoz, publicoAlvo, ambienteVisual } = req.body;

    console.log('\n🚀 === GERANDO PROMPT ===');
    console.log('📝 Dados recebidos:', { nicho, objetivo, cta, duracao, estiloVoz, idioma, tomVoz, publicoAlvo, ambienteVisual });
    
    // Validar campos obrigatórios
    if (!nicho || !objetivo) {
      console.log('❌ Campos obrigatórios faltando');
      return res.status(400).json({ error: 'Nicho e objetivo são obrigatórios' });
    }

    // Buscar usuário
    const user = await User.findById(session.id);

    // Verificar créditos (mas não bloquear, apenas log)
    const hasCredits = (user.promptCredits || 0) > 0;
    if (!hasCredits) {
      console.log('⚠️ Usuário sem créditos de prompt, mas continuando com o processamento...');
    }

    // Criar prompt com status "processing"
    // Nota: A cobrança de créditos é feita externamente
    const prompt = await Prompt.create({
      userId: user._id,
      inputBrief: { 
        nicho, 
        objetivo, 
        cta, 
        duracao, 
        estilo, 
        persona,
        estiloVoz,
        idioma,
        tomVoz,
        publicoAlvo,
        ambienteVisual,
      },
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
        estiloVoz,
        idioma,
        tomVoz,
        publicoAlvo,
        ambienteVisual,
        phone: user.phone || '',
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

    // Retorna resposta (webhook já foi enviado)
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

    // Buscar prompts excluindo os que falharam
    const prompts = await Prompt.find({ 
      userId: session.id,
      status: { $ne: 'failed' } // Excluir prompts com status failed
    })
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

    // Buscar usuário
    const user = await User.findById(session.id);

    // Verificar créditos (mas não bloquear, apenas log)
    const hasCredits = (user.videoCredits || 0) > 0;
    if (!hasCredits) {
      console.log('⚠️ Usuário sem créditos de vídeo, mas continuando com o processamento...');
    }

    // Criar vídeo com status "processing"
    // Nota: A cobrança de créditos é feita externamente
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
      phone: user.phone || '',
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

    // Retorna resposta (webhook já foi enviado)
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

    // Buscar vídeos excluindo os que falharam
    let videos = await Video.find({ 
      userId: session.id,
      status: { $ne: 'failed' } // Excluir vídeos com status failed
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    // Filtrar também vídeos que têm mensagens de erro sobre créditos no resultText
    videos = videos.filter(video => {
      const resultText = video.resultText || ''
      // Verificar se é uma mensagem de erro sobre créditos
      const isErrorAboutCredits = resultText.includes('créditos acabaram') || 
                                   resultText.includes('créditos para') ||
                                   resultText.includes('Adicione mais créditos') ||
                                   resultText.includes('adquira mais créditos')
      return !isErrorAboutCredits
    })
    
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
    
    const { 
      transactionId, 
      name, 
      email, 
      amount, 
      status, 
      cpf, 
      phone, 
      plan,
      promptCredits,
      videoCredits,
      WEBHOOK_SECRET 
    } = req.body;

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
          promptCredits: 0,
          videoCredits: 0,
        });
        console.log('✅ Usuário criado:', email);
      } else {
        // Atualizar informações do usuário se mudaram
        if (name && user.name !== name) user.name = name;
        if (phone && user.phone !== phone) user.phone = phone;
      }

      // Verificar se a transação já foi processada
      const existingTransaction = await Transaction.findOne({ transactionId });
      
      if (existingTransaction) {
        console.log('⚠️ Transação já processada:', transactionId);
        return res.json({ success: true, message: 'Transação já processada anteriormente' });
      }

      // Identificar tipo de produto baseado no valor recebido
      let productType = 'unknown';
      const amountValue = parseFloat(amount);
      
      if (amountValue === 87.82) {
        productType = 'monthly';
      } else if (amountValue === 53.41) {
        productType = 'videoUpsell';
      } else if (amountValue === 26.25) {
        productType = 'promptUpsell';
      }

      // Criar registro de transação
      await Transaction.create({
        userId: user._id,
        userEmail: email,
        userName: name,
        userPhone: phone,
        userCpf: cpf,
        transactionId,
        status,
        amount: amountValue,
        evento: 'paid',
        productType,
      });

      console.log('✅ Transação registrada:', {
        transactionId,
        amount: amountValue,
        productType,
      });

      // Adicionar créditos conforme informado no payload
      const promptCreditsToAdd = Number(promptCredits) || 0;
      const videoCreditsToAdd = Number(videoCredits) || 0;
      
      const oldPromptCredits = Number(user.promptCredits) || 0;
      const oldVideoCredits = Number(user.videoCredits) || 0;
      
      user.promptCredits = oldPromptCredits + promptCreditsToAdd;
      user.videoCredits = oldVideoCredits + videoCreditsToAdd;
      await user.save();
      
      console.log(`💰 Créditos adicionados: Prompts ${oldPromptCredits} + ${promptCreditsToAdd} = ${user.promptCredits} | Vídeos ${oldVideoCredits} + ${videoCreditsToAdd} = ${user.videoCredits}`);

      await CreditTransaction.create({
        userId: user._id,
        type: 'credit',
        amount: promptCreditsToAdd + videoCreditsToAdd,
        reason: `Pagamento ${plan || 'premium'} aprovado - TXN ${transactionId}`,
        refId: transactionId,
      });

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
    console.log('\n📥 === CALLBACK RECEBIDO (Prompt/Video) ===');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { promptId, videoId, result, status, WEBHOOK_SECRET } = req.body;

    // Validar secret (opcional)
    const secret = process.env.WEBHOOK_PROMPT_CALLBACK_SECRET;
    if (secret && WEBHOOK_SECRET !== secret) {
      console.log('❌ Secret inválido');
      return res.status(401).json({ error: 'Secret inválido' });
    }

    // Usar videoId se promptId não existir (para compatibilidade com n8n que envia videoId como promptId)
    const id = videoId || promptId;
    const isVideo = !!videoId;

    if (!id) {
      console.log('❌ ID faltando (promptId ou videoId)');
      return res.status(400).json({ error: 'promptId ou videoId é obrigatório' });
    }

    // Se status for failure, não precisa de result
    if (!result && status !== 'failure' && status !== 'failed') {
      console.log('❌ result faltando');
      return res.status(400).json({ error: 'result é obrigatório' });
    }

    // Tentar buscar como Prompt primeiro (apenas se não foi explicitamente enviado videoId)
    if (!isVideo && promptId) {
      const prompt = await Prompt.findById(promptId);
      if (prompt) {
        console.log('✅ Prompt encontrado:', promptId);
        console.log('👤 UserId:', prompt.userId);

        // Atualizar prompt com resultado
        // Se status for "failure" ou "failed", não salvar o resultado
        if (status === 'failure' || status === 'failed') {
          prompt.status = 'failed';
          // Não salvar resultText quando for failure
        } else {
          prompt.resultText = result;
          prompt.status = 'completed';
        }
        await prompt.save();

        console.log('✅ Prompt atualizado com sucesso!');
        console.log('📊 Status:', prompt.status);
        if (prompt.status !== 'failed') {
          console.log('📄 Preview:', result.substring(0, 100) + '...');
        }

        return res.json({ success: true, message: 'Prompt atualizado' });
      }
      // Se não encontrou Prompt, pode ser que o promptId seja na verdade um videoId (erro de configuração do n8n)
      console.log('⚠️ Prompt não encontrado, tentando buscar como Vídeo...');
    }

    // Buscar como Vídeo (se videoId foi enviado ou se promptId não encontrou Prompt)
    const video = await Video.findById(id);
    if (video) {
      console.log('✅ Vídeo encontrado:', id);
      console.log('👤 UserId:', video.userId);

      // Atualizar vídeo com resultado
      // Se status for "failure" ou "failed", não salvar o resultado
      if (status === 'failure' || status === 'failed' || status === 'error') {
        video.status = 'failed';
        // Não salvar resultText quando for failure
      } else {
        video.status = 'completed';
        // Se vier result, salvar
        if (result) {
          video.resultText = result;
        }
      }
      
      // Se vieram assets, atualizar (mesmo em caso de failure)
      if (req.body.assets) {
        video.assets = req.body.assets;
      }
      
      await video.save();

      console.log('✅ Vídeo atualizado com sucesso!');
      console.log('📊 Status:', video.status);
      if (video.status !== 'failed') {
        console.log('📄 Preview do resultado salvo');
      }

      return res.json({ success: true, message: 'Vídeo atualizado' });
    }

    // Se não encontrou nem Prompt nem Vídeo
    console.log('❌ Prompt ou Vídeo não encontrado:', id);
    return res.status(404).json({ error: 'Prompt ou Vídeo não encontrado' });
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
    // Se status for "failure" ou "failed", não salvar o resultado
    if (status === 'failure' || status === 'failed' || status === 'error') {
      video.status = 'failed';
      // Não salvar resultText quando for failure
    } else {
      video.status = 'completed';
      // Se vier result, salvar
      if (result) {
        video.resultText = result;
      }
    }
    
    // Se vieram assets, atualizar (mesmo em caso de failure)
    if (req.body.assets) {
      video.assets = req.body.assets;
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

// Admin Metrics
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const token = req.cookies.accessToken;
    const session = sessions.get(token);

    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // IDs dos administradores
    const adminIds = ['69017c312d3349fdcd287356', '6901fdf32d3349fdcd28737c', '6902beede139a32841ef03d5'];
    
    if (!adminIds.includes(session.id.toString())) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    const { period = 'day' } = req.query;

    // Calcular data de início baseado no período
    let startDate = new Date();
    switch (period) {
      case 'hour':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    // Total de usuários cadastrados
    const totalUsers = await User.countDocuments();

    // Vídeos gerados no período
    const videosGenerated = await Video.countDocuments({
      createdAt: { $gte: startDate },
      status: { $ne: 'failed' }
    });

    // Prompts gerados no período
    const promptsGenerated = await Prompt.countDocuments({
      createdAt: { $gte: startDate },
      status: { $ne: 'failed' }
    });

    // Buscar vendas reais do banco de dados
    const transactions = await Transaction.find({
      createdAt: { $gte: startDate },
      $or: [
        { status: 'approved' },
        { status: 'paid' }
      ],
      evento: 'paid',
    });

    const sales = {
      monthly: transactions.filter(t => t.productType === 'monthly').length,
      videoUpsell: transactions.filter(t => t.productType === 'videoUpsell').length,
      promptUpsell: transactions.filter(t => t.productType === 'promptUpsell').length,
    };

    // Calcular receita total (soma dos valores realmente recebidos)
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    console.log('📊 Métricas Admin solicitadas:', {
      period,
      totalUsers,
      videosGenerated,
      promptsGenerated,
    });

    res.json({
      totalUsers,
      totalRevenue,
      videosGenerated,
      promptsGenerated,
      sales,
      period,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar métricas:', error);
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

