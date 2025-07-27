import { LoginDto, RegisterDto, JwtPayload } from './auth.dto';
export declare class AuthService {
    private userService;
    constructor();
    register(userData: RegisterDto): Promise<{
        user: any;
        token: string;
    }>;
    login(credentials: LoginDto): Promise<{
        user: any;
        token: string;
    }>;
    getCurrentUser(userId: number): Promise<import("../user/user.dto").UserResponseDto>;
    verifyToken(token: string): JwtPayload;
    private generateToken;
}
//# sourceMappingURL=auth.service.d.ts.map