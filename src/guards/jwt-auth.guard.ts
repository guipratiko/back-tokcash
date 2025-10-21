import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.accessToken;

    if (!token) {
      throw new UnauthorizedException('Token não encontrado');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.authService.validateUser(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      request.user = {
        id: user._id,
        email: user.email,
        role: user.role,
        credits: user.credits,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}

