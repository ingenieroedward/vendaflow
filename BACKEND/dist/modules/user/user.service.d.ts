import { CreateUserDto, UpdateUserDto, UserResponseDto, UsersListResponseDto } from "./user.dto";
import { PaginationQuery } from "../../core/utils/validation";
export declare class UserService {
    createUser(userData: CreateUserDto): Promise<UserResponseDto>;
    getAllUsers(query: PaginationQuery): Promise<UsersListResponseDto>;
    getUserById(id: number): Promise<UserResponseDto>;
    updateUser(id: number, updateData: UpdateUserDto): Promise<UserResponseDto>;
    deleteUser(id: number): Promise<void>;
    restoreUser(id: number): Promise<void>;
    private mapToResponseDto;
}
//# sourceMappingURL=user.service.d.ts.map