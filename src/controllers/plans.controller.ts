import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Plan, PlanDocument } from '../schemas/plan.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

const createOrderSchema = z.object({
  planCode: z.enum(['START', 'PRO', 'INFINITY']),
});

@Controller('plans')
export class PlansController {
  constructor(
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  @Get()
  async getPlans() {
    return this.planModel.find({ isActive: true }).lean();
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  async createOrder(@Body() body: any, @CurrentUser() user: any) {
    const { planCode } = createOrderSchema.parse(body);

    const plan = await this.planModel.findOne({ code: planCode, isActive: true });
    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    const order = await this.orderModel.create({
      userId: user.id,
      planCode: plan.code,
      priceBRL: plan.priceBRL,
      credits: plan.credits,
      status: 'pending',
      provider: 'n8n',
    });

    // Mock checkout URL (em produção seria URL real de pagamento)
    const checkoutUrl = `${process.env.FRONTEND_URL}/checkout/${order._id}`;

    return {
      order: {
        id: order._id,
        planCode: order.planCode,
        priceBRL: order.priceBRL,
        credits: order.credits,
        status: order.status,
      },
      checkoutUrl,
    };
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.orderModel.findOne({
      _id: id,
      userId: user.id,
    }).lean();

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    return { order };
  }
}

