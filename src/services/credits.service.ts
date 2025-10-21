import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreditTransaction, CreditTransactionDocument } from '../schemas/credit-transaction.schema';

@Injectable()
export class CreditsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(CreditTransaction.name) private transactionModel: Model<CreditTransactionDocument>,
  ) {}

  async getBalance(userId: string | Types.ObjectId): Promise<number> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('Usuário não encontrado');
    return user.credits;
  }

  async addCredits(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    refId?: string
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('Usuário não encontrado');

    user.credits += amount;
    await user.save();

    await this.transactionModel.create({
      userId: user._id,
      type: 'credit',
      amount,
      reason,
      refId,
    });
  }

  async consumeCredits(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    refId?: string
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('Usuário não encontrado');

    if (user.credits < amount) {
      throw new BadRequestException('Saldo de créditos insuficiente');
    }

    user.credits -= amount;
    await user.save();

    await this.transactionModel.create({
      userId: user._id,
      type: 'debit',
      amount,
      reason,
      refId,
    });
  }

  async getHistory(userId: string | Types.ObjectId, limit = 50) {
    return this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

