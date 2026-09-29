import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { ApplicationStatus, AwardStatus, AwardYearStatus } from '@aci/contracts';
import { PageQuery } from '@aci/nest-common';

export class CreateApplicationDto {
  @ApiProperty() @IsUUID() programId: string;
  @ApiPropertyOptional({ description: 'Why you deserve this scholarship' }) @IsOptional() @IsString() @MaxLength(4000) statement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) preferredCourse?: string;
}

export class StaffCreateApplicationDto {
  @ApiProperty() @IsUUID() athleteUserId: string;
  @ApiProperty() @IsUUID() programId: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() waiveFee?: boolean;
  @ApiPropertyOptional({ description: 'Mark as already approved by the university and send agreements immediately' })
  @IsOptional()
  @IsBoolean()
  universityApproved?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityApprovalDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class NoteDto {
  @ApiProperty() @IsString() @Length(1, 4000) body: string;
}

export class TransitionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class RejectDto {
  @ApiProperty() @IsString() @Length(3, 2000) reason: string;
}

export class UniversityDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) decision: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @ApiPropertyOptional({ description: 'Approval letter from the university' }) @IsOptional() @IsUUID() documentId?: string;
}

export class ApplicationQuery extends PageQuery {
  @IsOptional() @IsIn(Object.values(ApplicationStatus)) status?: string;
  @IsOptional() @IsUUID() programId?: string;
  @IsOptional() @IsUUID() universityId?: string;
  @IsOptional() @IsUUID() athleteUserId?: string;
}

export class AwardQuery extends PageQuery {
  @IsOptional() @IsIn(Object.values(AwardStatus)) status?: string;
  @IsOptional() @IsUUID() universityId?: string;
  @IsOptional() @IsString() @MaxLength(60) sport?: string;
  @IsOptional() @Type(() => Number) @IsInt() durationYears?: number;
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'DISPUTED']) confirmation?: string;
  @IsOptional() @IsUUID() athleteUserId?: string;
}

export class RenewalQuery extends PageQuery {
  @IsOptional() @IsIn(Object.values(AwardYearStatus)) status?: string;
  @IsOptional() @IsUUID() universityId?: string;
}

export class RegistrationDto {
  @ApiProperty({ description: 'I confirm I am enrolled for this academic year' }) @IsBoolean() enrollmentConfirmed: boolean;
  @ApiProperty({ description: "I will comply with the university's scholarship policy" }) @IsBoolean() policyAcknowledged: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) currentCourse?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) currentSemester?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) academicScore?: string;
  @ApiPropertyOptional({ description: 'Bonafide certificate / marksheet' }) @IsOptional() @IsUUID() documentId?: string;
}

export class AwardActionDto {
  @ApiProperty() @IsString() @Length(3, 1000) reason: string;
  @ApiPropertyOptional({ description: 'Revoke only: give the seat back to the program inventory' }) @IsOptional() @IsBoolean() returnSeat?: boolean;
}

export class ConfirmationDto {
  @ApiProperty({ enum: ['CONFIRMED', 'DISPUTED', 'PENDING'] }) @IsIn(['CONFIRMED', 'DISPUTED', 'PENDING']) status: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class DashboardQuery {
  @IsOptional() @IsIn(['month', 'quarter', 'year', 'all']) period?: 'month' | 'quarter' | 'year' | 'all';
}
