import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { handleServiceError } from 'src/common/utils/error-handler.util';
import { detectMimeTypeFromBase64, isValidBase64SizeGeneric, SUPPORTED_MIME_TYPES } from 'src/common/utils/base64.util';
import { normalizeEmail } from 'src/common/utils/email.util';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { instanceToPlain } from 'class-transformer';
import { DeepPartial, ILike, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RegisterUserDto } from './dtos/register-user.dto';
import { Crop } from '../crops/entities/crop.entity';
import { FilesService } from 'src/files/files.service';
import { LoginUserDto } from './dtos/login-user.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { JwtService } from '@nestjs/jwt';
import { Buffer } from 'buffer';
import * as otpGenerator from 'otp-generator';
import * as crypto from 'crypto';
import { MailerService } from '../mailer/mailer.service';
import { Certification } from '../certifications/entities/certification.entity';
import { QualityStandard } from '../quality-standards/entities/quality-standard.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User) private readonly usersRepository: Repository<User>,
        @InjectRepository(Crop) private readonly cropsRepository: Repository<Crop>,
        @InjectRepository(Certification) private readonly certificationsRepository: Repository<Certification>,
        @InjectRepository(QualityStandard) private readonly qualityStandardsRepository: Repository<QualityStandard>,
        private readonly filesService: FilesService,
        private readonly jwtService: JwtService,
        private readonly mailerService: MailerService,
    ){}

    async registerUserDropped(registerUserDto: RegisterUserDto){
        const { confirmPassword, cropIds, certificationIds, qualityStandardIds, userPhoto, farmPhoto, ...userData } = registerUserDto

        // Check userPhoto
        if (registerUserDto.userPhoto) {
            if (!this.isValidImageType(registerUserDto.userPhoto)) 
                throw new BadRequestException('userPhoto: Only jpeg/png images are allowed');

            if (!this.isValidatePhotoSize(registerUserDto.userPhoto))
                throw new BadRequestException('userPhoto: Image size must be 2MB or less');
        }

        // Check userPhoto
        if (registerUserDto.farmPhoto) {
            if (!this.isValidImageType(registerUserDto.farmPhoto)) 
                throw new BadRequestException('farmPhoto: Only jpeg/png images are allowed');

            if (!this.isValidatePhotoSize(registerUserDto.farmPhoto))
                throw new BadRequestException('farmPhoto: Image size must be 2MB or less');
        }

        // Document validation (businessRegCertDoc & taxIdCertDoc)
        if (registerUserDto.businessRegCertDoc) {
            if (!this.isValidImageType(registerUserDto.businessRegCertDoc)) {
                throw new BadRequestException('businessRegCertDoc: Only jpeg/png are allowed');
            }
            if (!this.isValidatePhotoSize(registerUserDto.businessRegCertDoc)) {
                throw new BadRequestException('businessRegCertDoc: Image size must be 2MB or less');
            }
        }

        if (registerUserDto.taxIdCertDoc) {
            if (!this.isValidImageType(registerUserDto.taxIdCertDoc)) {
                throw new BadRequestException('taxIdCertDoc: Only jpeg/png are allowed');
            }
            if (!this.isValidatePhotoSize(registerUserDto.taxIdCertDoc)) {
                throw new BadRequestException('taxIdCertDoc: Image size must be 2MB or less');
            }
        }

        // Check existingUser
        const existingUser = await this.usersRepository.findOne({where: { email: ILike(registerUserDto.email) }})

        if (registerUserDto.password !== registerUserDto.confirmPassword) throw new ConflictException('Passwords do not match.')

        if(existingUser) throw new ConflictException('Email already in use.');

        // Fetch crops from DB
        let crops: Crop[] = [];
        if (cropIds && cropIds.length > 0) {
            crops = await this.cropsRepository.findBy({ id: In(cropIds) });
            if (crops.length !== cropIds.length) throw new BadRequestException('One or more crop IDs are invalid')
        }

        // Fetch certifications from DB
        let certifications: Certification[] = [];
        if (certificationIds && certificationIds.length > 0) {
            certifications = await this.certificationsRepository.findBy({ id: In(certificationIds) });
            if (certifications.length !== certificationIds.length) throw new BadRequestException('One or more certification IDs are invalid')
        }

        // Fetch qualityStandards from DB
        let qualityStandards: QualityStandard[] = [];
        if (qualityStandardIds && qualityStandardIds.length > 0) {
            qualityStandards = await this.qualityStandardsRepository.findBy({ id: In(qualityStandardIds) });
            if (qualityStandards.length !== qualityStandardIds.length) throw new BadRequestException('One or more qualityStandard IDs are invalid')
        }

        const hashedPassword = await this.hashPassword(registerUserDto.password);

        const newUser = this.usersRepository.create({
            ...userData,
            password: hashedPassword,
            crops,
            certifications,
            qualityStandards
        } as DeepPartial<User>);

        // Save user first (so to have an id for relation)
        const savedUser = await this.usersRepository.save(newUser);

        // Upload photos if provided
        if (registerUserDto.userPhoto) {
            await this.filesService.uploadFile(registerUserDto.userPhoto, 'userPhoto', savedUser)
        }

        if (registerUserDto.farmPhoto) {
            await this.filesService.uploadFile(registerUserDto.farmPhoto, 'farmPhoto', savedUser)
        }

        // Upload registerUserDto.businessRegCertDoc if provided 
        if (registerUserDto.businessRegCertDoc) { 
            await this.filesService.uploadFile(registerUserDto.businessRegCertDoc, 'businessRegCertDoc', savedUser) 
        } 
        // Upload registerUserDto.taxIdCertDoc if provided 
        if (registerUserDto.taxIdCertDoc) { 
            await this.filesService.uploadFile(registerUserDto.taxIdCertDoc, 'taxIdCertDoc', savedUser) 
        }

        const otp = this.generateOtp();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);

        savedUser.userVerificationOtp = otp;
        savedUser.userVerificationOtpExpiryTime = expiry;
        await this.usersRepository.save(savedUser);

        // Send OTP email
        const mailResult = await this.mailerService.sendMail(
            savedUser.email,
            'OkoAgro - Verify your account',
            `Your OTP is: ${otp}. It expires in 10 minutes.`,
            `<h2>Your OTP is <b>${otp}</b></h2><p>It expires in 10 minutes.</p>`,
        );

        if (!mailResult.success) {
            return {
                statusCode: 400,
                message: 'Registration completed, but failed to send verification OTP email',
                data: { id: savedUser.id },
            };
        }

        return {
            statusCode: 201,
            message: 'Registration completed, verification OTP sent successfully!',
            data: { id: savedUser.id },
        };

    }

    async registerUser(registerUserDto: RegisterUserDto) {
        try{
            const {
                email,confirmPassword,cropIds,certificationIds,qualityStandardIds,
                userPhoto, farmPhoto, businessRegCertDoc, taxIdCertDoc,
                ...userData
            } = registerUserDto;
            const normalizedEmail = normalizeEmail(email);

            // VALIDATIONS
            if (registerUserDto.password !== registerUserDto.confirmPassword)
                throw new ConflictException('Passwords do not match.');

            if (registerUserDto.role === UserRole.ADMIN || registerUserDto.role === UserRole.SUPER_ADMIN) {
                throw new ForbiddenException('Admin accounts cannot be created using this endpoint.');
            }

            // Validate File
            const validateFile = (file: string, field: string) => {
                const detected = detectMimeTypeFromBase64(file);

                // Validate File Type
                if (!detected || !SUPPORTED_MIME_TYPES.includes(detected)) {
                    throw new BadRequestException( `${field}: Only jpeg/png/pdf formats are allowed.` );
                }

                // Validate size: 2MB
                const docSize = 2 * 1024 * 1024;
                if (!isValidBase64SizeGeneric(file, docSize)) {
                    throw new BadRequestException(`${field}: file size must be 2MB or less`);
                }
            };

            if (userPhoto) validateFile(userPhoto, 'userPhoto');
            if (farmPhoto) validateFile(farmPhoto, 'farmPhoto');
            if (businessRegCertDoc) validateFile(businessRegCertDoc, 'businessRegCertDoc');
            if (taxIdCertDoc) validateFile(taxIdCertDoc, 'taxIdCertDoc');

            // CHECK IF USER EXISTS
            const existingUser = await this.usersRepository.findOne({
                where: { email: ILike(normalizedEmail) },
                relations: ['files'],
            });

            // If fully registered → block duplicate registration
            if (existingUser && existingUser.userVerified === true) {
                throw new ConflictException('Email already in use.');
            }

            // FETCH RELATION DATA
            let crops: Crop[] = [];
            if (cropIds?.length) {
                crops = await this.cropsRepository.findBy({ id: In(cropIds) });
                if (crops.length !== cropIds.length)
                    throw new BadRequestException('One or more crop IDs are invalid');
            }

            let certifications: Certification[] = [];
            if (certificationIds?.length) {
                certifications = await this.certificationsRepository.findBy({ id: In(certificationIds) });
                if (certifications.length !== certificationIds.length)
                    throw new BadRequestException('One or more certification IDs are invalid');
            }

            let qualityStandards: QualityStandard[] = [];
            if (qualityStandardIds?.length) {
                qualityStandards = await this.qualityStandardsRepository.findBy({ id: In(qualityStandardIds) });
                if (qualityStandards.length !== qualityStandardIds.length)
                    throw new BadRequestException('One or more qualityStandard IDs are invalid');
            }

            // PREP USER ENTITY
            const hashedPassword = await this.hashPassword(registerUserDto.password);

            let user: User;

            if (!existingUser) {
                // First-time registration
                user = this.usersRepository.create({
                    ...userData,
                    email: normalizedEmail,
                    password: hashedPassword,
                    crops,
                    certifications,
                    qualityStandards,
                    userVerified: false,
                });

            } else {
                // User exists but not verified → update instead
                user = Object.assign(existingUser, {
                    ...userData,
                    email: normalizedEmail,
                    password: hashedPassword,
                    crops,
                    certifications,
                    qualityStandards,
                    userVerified: false,
                });
            }

            // Save user first (must exist to link files)
            const savedUser = await this.usersRepository.save(user);

            // UPLOAD FILES (each removes old if exists)
            const uploadIfProvided = async (file: string | undefined, description: string) => {
                if (file) {
                    await this.filesService.uploadFile(file, description, savedUser);
                }
            };

            await uploadIfProvided(userPhoto, 'userPhoto');
            await uploadIfProvided(farmPhoto, 'farmPhoto');
            await uploadIfProvided(businessRegCertDoc, 'businessRegCertDoc');
            await uploadIfProvided(taxIdCertDoc, 'taxIdCertDoc');

            // GENERATE OTP
            const otp = this.generateOtp();
            const expiry = new Date();
            expiry.setMinutes(expiry.getMinutes() + 10);

            savedUser.userVerificationOtp = otp;
            savedUser.userVerificationOtpExpiryTime = expiry;
            await this.usersRepository.save(savedUser);

            // SEND OTP EMAIL
            const mailResult = await this.mailerService.sendMail(
                savedUser.email,
                'OkoAgro - Verify your account',
                `Your OTP is: ${otp}. It expires in 10 minutes.`,
                `<h2>Your OTP is <b>${otp}</b></h2><p>It expires in 10 minutes.</p>`,
            );

            if (!mailResult.success) {
                return {
                    statusCode: 400,
                    message: 'Registration completed, but failed to send verification OTP email',
                    data: { id: savedUser.id },
                };
            }

            return {
                statusCode: 201,
                message: 'Registration completed, verification OTP sent successfully!',
                data: { id: savedUser.id },
            };
        } catch (error) {
            handleServiceError(error, 'An error occurred registrating user');
        }
    }

    async loginUser(loginUserDto: LoginUserDto) {
        const normalizedEmail = normalizeEmail(loginUserDto.email);
        const existingUser = await this.usersRepository.findOne({ 
            where: { email: ILike(normalizedEmail) },
            relations: ['crops','files','certifications','qualityStandards'],
        })

        if (!existingUser || !(await this.verifyPassword(loginUserDto.password, existingUser.password))) 
            throw new UnauthorizedException('Invalid credentials or account does not exist')

        if (!existingUser.userVerified) 
            throw new UnauthorizedException('Please verify your account before logging in');
        
        // Generate tokens
        const tokens = this.generateTokens(existingUser)

        return {
            statusCode: 200,
            message: 'Login successful',
            data: {
                user: instanceToPlain(existingUser),
                tokens
            },
        }
    }

    async resendOtp(userId: string) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new BadRequestException('User not found');

        const otp = this.generateOtp();
        const expiry = new Date();
        console.log("Now:", expiry.toLocaleString()); 

        expiry.setMinutes(expiry.getMinutes() + 10);
        console.log("Expiry:", expiry.toLocaleString());

        user.userVerificationOtp = otp;
        user.userVerificationOtpExpiryTime = expiry;
        await this.usersRepository.save(user);

        const mailResult = await this.mailerService.sendMail(
            user.email,
            'OkoAgro - New OTP Code',
            `Your OTP is: ${otp}. It expires in 10 minutes.`,
            `<h2>Your OTP is <b>${otp}</b></h2><p>It expires in 10 minutes.</p>`,
        );

        if (!mailResult.success) {
            return {
                statusCode: 400,
                message: 'OTP generated but failed to send email',
            };
        }

        return { statusCode: 200, message: 'OTP resent successfully' };
    }

    async verifyOtp(userId: string, otp: string) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new BadRequestException('Invalid email or OTP');

        if (user.userVerified) {
            return { statusCode: 200, message: 'User already verified' };
        }

        if (user.userVerificationOtp !== otp) {
            throw new BadRequestException('Invalid OTP');
        }

        if (new Date() > user.userVerificationOtpExpiryTime!) {
            throw new BadRequestException('OTP expired');
        }

        user.userVerified = true;
        user.userVerificationOtp = null;
        user.userVerificationOtpExpiryTime = null;
        await this.usersRepository.save(user);

        return { statusCode: 200, message: 'User verified successfully' };
    }

    
    async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
        const email = normalizeEmail(forgotPasswordDto.email);
        const user = await this.usersRepository.findOne({ where: { email: ILike(email) } });

        if (!user) throw new NotFoundException('User with email not found');

        // create token & save hashed token in DB
        const { token, hashedToken, expiresAt } = this.createPasswordResetToken();
        user.passwordResetToken = hashedToken;
        user.passwordResetExpiryTime = expiresAt;
        await this.usersRepository.save(user);

        // Build reset URL for client
        const clientUrlBase = process.env.CLIENT_NEW_PASSWORD_URL ?? '';
        const resetUrl = `${clientUrlBase}${token}`;
        console.log("resetUrl:", resetUrl);

        // email content
        const subject = 'OkoAgro Account Reset Password';
        const text = `You requested a password reset. Click the link to set a new password (valid 10 minutes): ${resetUrl}`;
        const html = `<p>You requested a password reset.</p><p>Click the link to set a new password (valid 10 minutes):</p>
                        <p><a href="${resetUrl}">Click to reset password</a></p>`;

        const result = await this.mailerService.sendMail(user.email, subject, text, html);

        if (!result.success) throw new BadRequestException('Failed to send reset email. Please try again later.');

        return {
            statusCode: 200,
            message: 'Reset password link sent to email!',
        };
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        const { resetToken, newPassword, confirmPassword } = resetPasswordDto;
        if (!resetToken || !newPassword || !confirmPassword) {
            throw new BadRequestException('Token with password is required');
        }
        if (newPassword !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        // hash incoming token & find user that has that hashed token
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await this.usersRepository.findOne({
            where: {
                passwordResetToken: hashedToken,
            },
        });

        // check token not expired
        if (!user || !user.passwordResetExpiryTime || new Date() > user.passwordResetExpiryTime) {
            throw new ConflictException('Token is invalid or expired');
        }

        // set new password
        const hashedPwd = await this.hashPassword(newPassword);
        user.password = hashedPwd;
        user.passwordResetToken = null;
        user.passwordResetExpiryTime = null;
        user.passwordChangedAt = new Date();

        await this.usersRepository.save(user);

        return { statusCode: 200, message: 'Password reset successfully' };
    }


    async getRefreshToken(refreshToken: string) {
        try{
            const payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET })

            const user = await this.usersRepository.findOne({ where: {id: payload.sub} })

            if (!user) throw new UnauthorizedException('Invalid token')

            const accessToken = this.generateAccessToken(user)
            return { accessToken }
        }catch(e){
            throw new UnauthorizedException('Invalid token')
        }
    }

    async getUserById(userId: string) {
        try{
            const user = await this.usersRepository.findOne({ 
                where: {id: userId},
                relations: ['crops','files','certifications','qualityStandards']
            })

            if (!user) throw new NotFoundException('User not found')

            // const {password, ...userData} = user;
            return instanceToPlain(user)
        }catch(error){
            handleServiceError(error, 'An error occurred');
        }
    }

    // ***HELPER METHODS***

    async hashPassword(password : string): Promise<string> {
        return bcrypt.hash(password, 10);
    }

    private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword)
    }

    private generateTokens(user: User) {
        return {
            accessToken: this.generateAccessToken(user),
            refreshToken: this.generateRefreshToken(user)
        }
    }

    private generateAccessToken(user: User): string {
        const payload = {
            email: user.email,
            sub: user.id,
            role: user.role
        }

        return this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES // 15m
        })
    }

    private generateRefreshToken(user: User): string {
        const payload = {
            sub: user.id
        };

        return this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: process.env.JWT_REFRESH_EXPIRES // '7d'
        })
    }

    private isValidImageType(base64: string): boolean {
        try {
            const headerMatch = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

            if (headerMatch && headerMatch[1]) {
                const mimeType = headerMatch[1].toLowerCase();
                return ['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType);
            }

            // Fallback: check magic numbers
            const base64Data = base64.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // JPEG
            if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

            // PNG
            if (
                buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4e &&
                buffer[3] === 0x47
            ) return true;

            return false;
        } catch (error) {
            console.error('Error in isValidImageType:', error);
            return false;
        }
    }

    private isValidatePhotoSize(base64: string): boolean {
        try {
            // Strip out header (case-insensitive)
            const base64Data = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

            // Remove padding chars
            const padding = (base64Data.match(/=*$/) || [''])[0].length;

            // Calculate size in bytes
            const sizeInBytes = (base64Data.length * 3) / 4 - padding;

            return sizeInBytes <= 2 * 1024 * 1024; // 2MB
        } catch {
            return false;
        }
    }

    private isValidDocType(base64: string): boolean {
        try {
            // Match the MIME type in the base64 header
            const headerMatch = base64.match(/^data:([a-zA-Z0-9/+.-]+);base64,/);

            if (headerMatch && headerMatch[1]) {
                const mimeType = headerMatch[1].toLowerCase();

                const allowedTypes = [
                    'image/jpeg',
                    'image/jpg',
                    'image/pjpeg',   // progressive JPEG
                    'image/png',
                    'image/x-png',   // older png encoding
                    'application/pdf'
                ];

                return allowedTypes.includes(mimeType);
            }

            return false;
        } catch (error) {
            console.error('Error in isValidDocType:', error);
            return false;
        }
    }



    private isValidDocSize(base64: string): boolean {
        try {
            const base64Data = base64.replace(/^data:.*;base64,/, '');
            const padding = (base64Data.match(/=*$/) || [''])[0].length;
            const sizeInBytes = (base64Data.length * 3) / 4 - padding;
            return sizeInBytes <= 600 * 1024; // 600KB
        } catch {
            return false;
        }
    }


    private generateOtp(): string {
        return otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false,
        });
    }

    private createPasswordResetToken(): { token: string; hashedToken: string; expiresAt: Date } {
        // plain token to send via email
        const token = crypto.randomBytes(32).toString('hex'); // 64 chars
        // hashed token to store in DB
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        console.log("NOW:", Date.now().toLocaleString());
        console.log("EXPIRY:", expiresAt.toLocaleString());
        return { token, hashedToken, expiresAt };
    }

}