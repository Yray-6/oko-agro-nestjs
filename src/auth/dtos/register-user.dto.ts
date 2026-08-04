import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsEmail, IsNotEmpty, IsEnum, IsArray, IsOptional, MinLength } from "class-validator";
import { BusinessType, EstimatedAnnualProductionUnit, FarmSizeUnit, OperatingDaysPerWeek, ProcesssingCapacityUnit, UserRole } from "src/users/entities/user.entity";

export class RegisterUserDto {
    // Basic Info
    @ApiProperty({ description: 'Provide user firstName' })
    @IsString()
    @IsNotEmpty({message: 'Password is required'})
    firstName: string;

    @ApiProperty({ description: 'Provide user lastName' })
    @IsString()
    @IsNotEmpty({message: 'LastName is required'})
    lastName: string;

    @ApiProperty({ description: 'Provide user email' })
    @IsEmail({}, {message: 'Provide a valid email'})
    @IsNotEmpty({message: 'Email is required'})
    email: string;

    @ApiProperty({ description: 'Provide user phoneNumber' })
    @IsString()
    @IsNotEmpty({message: 'PhoneNumber is required'})
    phoneNumber: string;

    @ApiProperty({ description: 'Provide user farmAddress' })
    @IsString()
    @IsOptional()
    farmAddress?: string;

    @ApiProperty({ description: 'Provide user country' })
    @IsString()
    @IsOptional()
    country?: string;

    @ApiProperty({ description: 'Provide user state' })
    @IsString()
    @IsOptional()
    state?: string;

    // Farm Details
    @ApiProperty({ description: 'Provide user farmName' })
    @IsString()
    @IsOptional()
    farmName?: string;

    @ApiProperty({ description: 'Provide user farmSize' })
    @IsString()
    @IsOptional()
    farmSize?: string;

    @ApiProperty({ enum: FarmSizeUnit, example: FarmSizeUnit.HECTARE, description: 'Provide user farmSizeUnit'})
    @IsEnum(FarmSizeUnit)
    @IsOptional()
    farmSizeUnit?: FarmSizeUnit;

    @ApiProperty({ description: 'Provide user estimatedAnnualProduction' })
    @IsString()
    @IsOptional()
    estimatedAnnualProduction?: string;

    @ApiProperty({ enum: EstimatedAnnualProductionUnit, example: EstimatedAnnualProductionUnit.TONNE, description: 'Provide user estimatedAnnualProductionUnit'})
    @IsEnum(EstimatedAnnualProductionUnit)
    @IsOptional()
    estimatedAnnualProductionUnit?: EstimatedAnnualProductionUnit;

    // Crops (array of crop IDs from frontend)
    @ApiProperty({ example: ["8hfeiweji9rfwjkowstring64","8hfeiweji9rfwjkowstring64"] , description: 'Provide user cropIds'})
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    cropIds?: string[];

    // Processor Company specific Info
    @ApiProperty({ description: 'Provide user companyName' })
    @IsString()
    @IsOptional()
    companyName?: string;

    @ApiProperty({ description: 'Provide user businessRegNumber' })
    @IsString()
    @IsOptional()
    businessRegNumber?: string;

    @ApiProperty({ description: 'Provide user yearEstablished' })
    @IsString()
    @IsOptional()
    yearEstablished?: string;

    @ApiProperty({ enum: BusinessType, example: BusinessType.FOODPROCESSING, description: 'Provide user businessType' })
    @IsEnum(BusinessType)
    @IsOptional()
    businessType?: BusinessType;

    @ApiProperty({ description: 'Provide user companyName' })
    @IsString()
    @IsOptional()
    processsingCapacitySize?: string;

    @ApiProperty({ enum: ProcesssingCapacityUnit, example: ProcesssingCapacityUnit.TONS, description: 'Provide user ProcesssingCapacityUnit'})
    @IsEnum(ProcesssingCapacityUnit)
    @IsOptional()
    processsingCapacityUnit?: ProcesssingCapacityUnit;

    @ApiProperty({ enum: OperatingDaysPerWeek, example: OperatingDaysPerWeek.FIVEDAYS, description: 'Provide user OperatingDaysPerWeek'})
    @IsEnum(OperatingDaysPerWeek)
    @IsOptional()
    operatingDaysPerWeek?: OperatingDaysPerWeek;

    @ApiProperty({ description: 'Provide user storageCapacity' })
    @IsString()
    @IsOptional()
    storageCapacity?: string;

    @ApiProperty({ description: 'Provide user minimumOrderQuality' })
    @IsString()
    @IsOptional()
    minimumOrderQuality?: string;

    @ApiProperty({ description: 'Provide user operationsType' })
    @IsString()
    @IsOptional()
    operationsType?: string;

    // Quality Standards & Certifications
    @ApiProperty({ example: ["8hfeiweji9rfwjkowstring64","8hfeiweji9rfwjkowstring64"] , description: 'Provide user qualityStandardIds'})
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    qualityStandardIds?: string[];

    @ApiProperty({ example: ["8hfeiweji9rfwjkowstring64","8hfeiweji9rfwjkowstring64"] , description: 'Provide user certificationIds'})
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    certificationIds?: string[];

    // Experience Assessment
    @ApiProperty({ description: 'Provide user farmingExperience' })
    @IsString()
    @IsOptional()
    farmingExperience?: string;

    @ApiProperty({ description: 'Provide user internetAccess' })
    @IsString()
    @IsOptional()
    internetAccess?: string;

    @ApiProperty({ description: 'Provide user howUserSellCrops' })
    @IsString()
    @IsOptional()
    howUserSellCrops?: string;

    // Picture Verification (base64 strings)
    @ApiProperty({ description: 'Provide user farmPhoto (base64 strings)' })
    @IsString()
    @IsOptional()
    farmPhoto?: string;

    @ApiProperty({ description: 'Provide user userPhoto (base64 strings)' })
    @IsString()
    @IsOptional()
    userPhoto?: string;

    // Document Verification (base64 strings for jpeg/png/pdf)
    @ApiProperty({ description: 'Provide user businessRegCertDoc (base64 strings)' })
    @IsString()
    @IsOptional()
    businessRegCertDoc?: string;

    @ApiProperty({ description: 'Provide user taxIdCertDoc (base64 strings)' })
    @IsString()
    @IsOptional()
    taxIdCertDoc?: string;

    // Payment Setup
    @ApiProperty({ description: 'Provide user bankName' })
    @IsString()
    @IsOptional()
    bankName?: string;

    @ApiProperty({ description: 'Provide user accountNumber' })
    @IsString()
    @IsOptional()
    accountNumber?: string;

    // System Role
    @ApiProperty({ enum: UserRole, example: UserRole.FARMER, description: 'Provide user role'})
    @IsEnum(UserRole)
    role: UserRole;

    // Auth fields
    @ApiProperty({ description: 'Provide user password' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiProperty({ description: 'Provide user confirmPassword' })
    @IsString()
    @IsNotEmpty()
    confirmPassword: string;
}