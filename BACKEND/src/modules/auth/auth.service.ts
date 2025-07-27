import jwt from 'jsonwebtoken';
import { User } from '@/modules/user/user.model';
import { UserService } from '@/modules/user/user.service';
import { 
  LoginDto, 
  RegisterDto,
  JwtPayload 
} from './auth.dto';
import { 
  UnauthorizedError, 
} from '@/core/errors/AppError';
import { validateSchema } from '@/core/utils/validation';
import { config } from '@/config';
import { 
  loginSchema, 
  registerSchema
} from './auth.dto';
import { CreateUserDto } from '../user/user.dto';

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async register(userData: RegisterDto): Promise<{ user: any; token: string }> {
    const validatedData = validateSchema(registerSchema, userData);

    // Create user using UserService
    const user = await this.userService.createUser(validatedData as CreateUserDto);

    // Generate token
    const token = this.generateToken(user.id, user.username, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      token,
    };
  }

  async login(credentials: LoginDto): Promise<{ user: any; token: string }> {
    const validatedData = validateSchema(loginSchema, credentials);

    // Find user by username
    const user = await User.findOne({ where: { username: validatedData.username } });
    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Generate token
    const token = this.generateToken(user.id, user.username, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      token,
    };
  }

  async getCurrentUser(userId: number) {
    return await this.userService.getUserById(userId);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  private generateToken(userId: number, username: string, role: 'buyer' | 'admin' | 'seller'): string {
    const payload: JwtPayload = {
      userId,
      username,
      role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });
  }
} 