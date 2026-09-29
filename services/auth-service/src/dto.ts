import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { OtpChannel, Role } from '@aci/contracts';

export type Audience = 'student' | 'staff';

export class RequestOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ enum: Object.values(OtpChannel) })
  @IsIn(Object.values(OtpChannel))
  channel: OtpChannel;

  @ApiProperty({ enum: ['student', 'staff'] })
  @IsIn(['student', 'staff'])
  audience: Audience;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Object.values(OtpChannel) })
  @IsOptional()
  @IsIn(Object.values(OtpChannel))
  preferredOtpChannel?: OtpChannel;
}

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: [Role.ADMIN, Role.FINANCE, Role.REVIEWER, Role.UNIVERSITY_REP, Role.SUPER_ADMIN] })
  @IsIn([Role.ADMIN, Role.FINANCE, Role.REVIEWER, Role.UNIVERSITY_REP, Role.SUPER_ADMIN])
  role: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  universityId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Object.values(Role) })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  universityId?: string;
}

export class EnsureAthleteDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
