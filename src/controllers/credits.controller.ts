import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreditsService } from '../services/credits.service';

@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private creditsService: CreditsService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: any) {
    const balance = await this.creditsService.getBalance(user.id);
    return { balance };
  }

  @Get('history')
  async getHistory(@CurrentUser() user: any) {
    const history = await this.creditsService.getHistory(user.id);
    return { history };
  }
}

