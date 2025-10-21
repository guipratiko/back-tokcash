import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const registerSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  sexo: z.enum(['masculino', 'feminino', 'outro']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const parsed = registerSchema.parse(body);
    const result = await this.authService.register(parsed as any);

    // Cookies httpOnly
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const parsed = loginSchema.parse(body);
    const result = await this.authService.login(parsed as any);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new Error('Refresh token não encontrado');
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logout realizado com sucesso' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return { user: req.user };
  }
}

