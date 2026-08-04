import { ApiProperty } from "@nestjs/swagger";
import { ApiResponseDto } from "src/common/dto/api-response.dto";
import { User } from "src/users/entities/user.entity";

export class registerUserData {
    @ApiProperty({ example: "8hfeiweji9rfwjkowstring64" })
    id: string;
}

export class registerUserResponseDto extends ApiResponseDto<registerUserData> {
    @ApiProperty({ example: 201 })
    declare statusCode: number;

    @ApiProperty({ example: 'Registration completed, verification OTP sent successfully!' })
    declare message: string;

    @ApiProperty({ type: () => registerUserData })
    declare data: registerUserData;
}

export class AuthTokensDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    accessToken: string;

    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    refreshToken: string;
}

export class LoginUserData {
    @ApiProperty({ type: () => User })
    user: User;

    @ApiProperty({ type: () => AuthTokensDto })
    tokens: AuthTokensDto;
}

export class LoginUserResponseDto extends ApiResponseDto<LoginUserData> {
    @ApiProperty({ example: 200 })
    declare statusCode: number;

    @ApiProperty({ example: 'Login successful' })
    declare message: string;

    @ApiProperty({ type: () => LoginUserData })
    declare data: LoginUserData;
}

export class RefreshTokenResponseDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    accessToken: string;
}

export class VerifyOtpResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 200 })
    declare statusCode: number;

    @ApiProperty({ example: 'User verified successfully' })
    declare message: string;
}

export class ResendOtpResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 200 })
    declare statusCode: number;

    @ApiProperty({ example: 'OTP resent successfully' })
    declare message: string;
}

export class ForgotPasswordResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 200 })
    declare statusCode: number;

    @ApiProperty({ example: 'Reset password link sent to email!' })
    declare message: string;
}

export class ResetPasswordResponseDto extends ApiResponseDto<undefined> {
    @ApiProperty({ example: 200 })
    declare statusCode: number;

    @ApiProperty({ example: 'Password reset successfully' })
    declare message: string;
}

export class ProfileResponseDto {
    @ApiProperty({ example: '8hfeiweji9rfwjkowstring64' })
    id: string;

    @ApiProperty({ example: 'John' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ example: 'john@example.com' })
    email: string;

    @ApiProperty({ example: 'farmer' })
    role: string;
}
