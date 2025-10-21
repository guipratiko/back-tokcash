import 'dotenv/config';
import 'reflect-metadata';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Plan, PlanSchema } from '../schemas/plan.schema';
import { Trend, TrendSchema } from '../schemas/trend.schema';
import { User, UserSchema } from '../schemas/user.schema';

const PlanModel = mongoose.model(Plan.name, PlanSchema);
const TrendModel = mongoose.model(Trend.name, TrendSchema);
const UserModel = mongoose.model(User.name, UserSchema);

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB,
    });

    console.log('🔗 Conectado ao MongoDB');

    // Seed Planos
    console.log('🌱 Criando planos...');
    await PlanModel.deleteMany({});
    
    const plans = [
      {
        code: 'START',
        name: 'START CASH',
        priceBRL: 97,
        credits: 15,
        description: 'Assinatura mensal • Comece sua jornada com IA e gere seus primeiros vídeos virais.',
        features: [
          '15 créditos renovados todo mês',
          'Geração automática de vídeos curtos e engajantes',
          'Tendências semanais do TikTok',
          'Biblioteca de prompts virais prontos',
          'Ideal para iniciar',
          'Ganhos médios até R$3.900/mês',
        ],
        isActive: true,
      },
      {
        code: 'PRO',
        name: 'VIRAL PRO',
        priceBRL: 197,
        credits: 30,
        description: 'Assinatura mensal • Transforme vídeos em lucro com IA.',
        features: [
          '30 créditos renovados todo mês',
          'Roteiro, voz, legenda e vídeo pronto',
          'Edição automática e otimização de performance',
          'Relatórios de engajamento e monetização',
          '⭐ Mais popular',
          'Ganhos médios até R$10.000/mês',
        ],
        isActive: true,
      },
      {
        code: 'INFINITY',
        name: 'INFINITY CASH',
        priceBRL: 497,
        credits: 100,
        description: 'Assinatura mensal • 🚀 Poder máximo, escala total.',
        features: [
          '100 créditos renovados todo mês',
          'Consultoria rápida com especialista Tok Cash',
          'Suporte prioritário e acesso antecipado às novas IAs',
          'Benefícios exclusivos da comunidade',
          'Créditos não utilizados acumulam',
          'Ganhos médios R$30.000+/mês',
        ],
        isActive: true,
      },
    ];

    await PlanModel.insertMany(plans);
    console.log('✅ 3 planos criados: START (R$97/15), PRO (R$197/30), INFINITY (R$497/100)');

    // Seed Trends
    console.log('🌱 Criando trends...');
    await TrendModel.deleteMany({});

    const trends = [
      {
        title: 'Storytelling Emocional',
        platform: 'tiktok',
        keywords: ['storytime', 'vida real', 'superação', 'motivação'],
        exampleHooks: [
          'Essa história mudou minha vida...',
          'Ninguém acredita quando eu conto isso',
          'Eu tinha apenas 3 dias para decidir...',
        ],
      },
      {
        title: 'Dicas Rápidas de Produtividade',
        platform: 'shorts',
        keywords: ['produtividade', 'hack', 'rotina', 'organização'],
        exampleHooks: [
          'Esse truque triplicou minha produtividade',
          '3 apps que mudaram minha vida',
          'Como eu organizo 10h de trabalho em 4h',
        ],
      },
      {
        title: 'Antes & Depois Impactante',
        platform: 'reels',
        keywords: ['transformação', 'resultado', 'progresso', 'evolução'],
        exampleHooks: [
          'De 0 a 10k em 30 dias',
          'Veja o que aconteceu em 1 semana',
          'Ninguém acreditou nessa transformação',
        ],
      },
      {
        title: 'Segredos de Nicho',
        platform: 'tiktok',
        keywords: ['segredo', 'bastidores', 'revelação', 'exclusivo'],
        exampleHooks: [
          'Isso ninguém te conta sobre...',
          'O segredo dos profissionais é...',
          'Por que isso é escondido de você',
        ],
      },
      {
        title: 'Tutorial Express',
        platform: 'shorts',
        keywords: ['tutorial', 'passo a passo', 'aprender', 'fazer'],
        exampleHooks: [
          'Como fazer em 60 segundos',
          'Tutorial completo e gratuito',
          'Aprenda isso em menos de 1 minuto',
        ],
      },
      {
        title: 'Polêmica Construtiva',
        platform: 'reels',
        keywords: ['opinião', 'verdade', 'realidade', 'fato'],
        exampleHooks: [
          'Vou falar o que ninguém fala',
          'A verdade que você precisa ouvir',
          'Desculpa, mas isso é mentira',
        ],
      },
    ];

    await TrendModel.insertMany(trends);
    console.log('✅ 6 trends criadas');

    // Seed Admin User
    console.log('🌱 Criando usuário admin...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tokcash.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    const existingAdmin = await UserModel.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await UserModel.create({
        name: 'Admin TokCash',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        credits: 1000,
      });
      console.log(`✅ Admin criado: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log('⚠️  Admin já existe');
    }

    console.log('\n🎉 Seed completo!');
    console.log('📊 Resumo:');
    console.log('   - 3 planos ativos');
    console.log('   - 6 trends disponíveis');
    console.log(`   - 1 usuário admin (${adminEmail})`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();

