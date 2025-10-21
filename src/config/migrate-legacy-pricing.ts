import 'dotenv/config';
import 'reflect-metadata';
import * as mongoose from 'mongoose';
import { Plan, PlanSchema } from '../schemas/plan.schema';

const PlanModel = mongoose.model(Plan.name, PlanSchema);

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB,
    });

    console.log('🔗 Conectado ao MongoDB');
    console.log('🔄 Iniciando migração de preços legados...\n');

    // Detectar e corrigir START com 10 créditos
    const legacyStart = await PlanModel.findOne({ code: 'START', credits: 10 });
    if (legacyStart) {
      console.log('⚠️  Detectado: START com 10 créditos (legado)');
      legacyStart.credits = 15;
      legacyStart.priceBRL = 97;
      await legacyStart.save();
      console.log('✅ Corrigido: START agora tem 15 créditos e R$97');
    } else {
      console.log('✓  START está correto (15 créditos)');
    }

    // Detectar e corrigir PRO com R$297
    const legacyPro = await PlanModel.findOne({ code: 'PRO', priceBRL: 297 });
    if (legacyPro) {
      console.log('⚠️  Detectado: PRO com R$297 (legado)');
      legacyPro.priceBRL = 197;
      legacyPro.credits = 30;
      await legacyPro.save();
      console.log('✅ Corrigido: PRO agora tem R$197 e 30 créditos');
    } else {
      console.log('✓  PRO está correto (R$197)');
    }

    // Verificar INFINITY
    const infinity = await PlanModel.findOne({ code: 'INFINITY' });
    if (infinity) {
      if (infinity.priceBRL !== 497 || infinity.credits !== 100) {
        console.log('⚠️  Detectado: INFINITY com valores incorretos');
        infinity.priceBRL = 497;
        infinity.credits = 100;
        await infinity.save();
        console.log('✅ Corrigido: INFINITY agora tem R$497 e 100 créditos');
      } else {
        console.log('✓  INFINITY está correto (R$497/100)');
      }
    }

    console.log('\n🎉 Migração concluída!');
    console.log('📊 Valores padronizados:');
    console.log('   - START: R$97 / 15 créditos');
    console.log('   - PRO: R$197 / 30 créditos');
    console.log('   - INFINITY: R$497 / 100 créditos');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

migrate();

