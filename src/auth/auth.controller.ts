import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dtos/register-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    ForgotPasswordResponseDto,
    LoginUserResponseDto,
    ProfileResponseDto,
    RefreshTokenResponseDto,
    registerUserResponseDto,
    ResendOtpResponseDto,
    ResetPasswordResponseDto,
    VerifyOtpResponseDto,
} from './dtos/response.dto';
import { ResendOtpDto } from './dtos/resend-otp.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({status: 201, description: 'User registered successfully', type: registerUserResponseDto})
    @Post('register-user')
    @HttpCode(HttpStatus.CREATED)
    async registerUser(@Body() registerUserDto: RegisterUserDto) {
        return await this.authService.registerUser(registerUserDto)
    }
    
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'Login successful', type: LoginUserResponseDto })
    @Post('login-user')
    @HttpCode(HttpStatus.OK)
    async loginUser(@Body() loginUserDto: LoginUserDto) {
        return await this.authService.loginUser(loginUserDto)
    }

    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Access token refreshed successfully', type: RefreshTokenResponseDto })
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() body: RefreshTokenDto) {
        return await this.authService.getRefreshToken(body.refreshToken)
    }

    // ✅ Verify OTP
    @ApiOperation({ summary: 'Verify otp sent to user email (User registration-verification)' })
    @ApiResponse({ status: 200, description: 'User verified successfully', type: VerifyOtpResponseDto })
    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto ) {
        return this.authService.verifyOtp(verifyOtpDto.userId, verifyOtpDto.otp);
    }

    // ✅ Resend OTP
    @ApiOperation({ summary: 'Resend user registration-verification otp to user email' })
    @ApiResponse({ status: 200, description: 'OTP resent successfully', type: ResendOtpResponseDto })
    @Post('resend-otp')
    @HttpCode(HttpStatus.OK)
    async resendOtp(@Body() body: ResendOtpDto) {
        return this.authService.resendOtp(body.userId);
    }

    @ApiOperation({ summary: 'Forgot-password (Request for reset-password client url)' })
    @ApiResponse({ status: 200, description: 'Reset password link sent to email!', type: ForgotPasswordResponseDto })
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto);
    }

    @ApiOperation({ summary: 'Reset-password (change a new password)' })
    @ApiResponse({ status: 200, description: 'Password reset successfully', type: ResetPasswordResponseDto })
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }

    // Proctected
    @ApiOperation({ summary: 'Get Logged in User profile details' })
    @ApiResponse({ status: 200, description: 'User profile returned successfully', type: ProfileResponseDto })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @HttpCode(HttpStatus.OK)
    getProfile(@CurrentUser() user: any){
        return user;
    }
}
