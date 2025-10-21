import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../schemas/user.schema';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  sexo?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Validar CPF e telefone
    if (!dto.cpf) {
      throw new BadRequestException('CPF é obrigatório');
    }
    
    if (!dto.phone) {
      throw new BadRequestException('Telefone é obrigatório');
    }

    // Validar senha forte
    this.validatePasswordStrength(dto.password);

    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new BadRequestException('Email já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      cpf: dto.cpf,
      phone: dto.phone,
      sexo: dto.sexo,
      role: 'user',
      credits: 0,
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async validateUser(userId: string) {
    return this.userModel.findById(userId).select('-passwordHash').lean();
  }

  private validatePasswordStrength(password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('Senha deve ter no mínimo 8 caracteres');
    }
    
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Senha deve conter pelo menos uma letra minúscula');
    }
    
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Senha deve conter pelo menos uma letra maiúscula');
    }
    
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Senha deve conter pelo menos um número');
    }
  }

  private generateTokens(user: UserDocument) {
    const payload = { sub: user._id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
      },
    };
  }
}

