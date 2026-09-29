import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AcademicLevel, AgeGroup, AthleteDocumentType, FitnessLevel, Gender, RankingLevel, ScoreType } from '@aci/contracts';
import { PageQuery } from '@aci/nest-common';

const PHONE = /^\+?[\d\s-]{8,18}$/;

export class PersonalInfoDto {
  @ApiProperty() @IsString() @Length(1, 60) firstName: string;
  @ApiProperty() @IsString() @Length(1, 60) lastName: string;
  @ApiProperty({ example: '2006-05-14' }) @IsDateString() dateOfBirth: string;
  @ApiProperty({ enum: Object.values(Gender) }) @IsIn(Object.values(Gender)) gender: string;
  @ApiProperty() @IsString() @Length(2, 60) nationality: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() profilePhotoDocumentId?: string;

  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE) whatsappNumber?: string;
  @ApiProperty() @IsString() @Length(3, 250) addressLine: string;
  @ApiProperty() @IsString() @Length(2, 80) city: string;
  @ApiProperty() @IsString() @Length(2, 80) state: string;
  @ApiProperty() @Matches(/^[A-Za-z0-9 -]{3,10}$/) zipCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) country?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) guardianName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) guardianRelation?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE) guardianPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() guardianEmail?: string;
}

export class AcademicRecordDto {
  @ApiProperty({ enum: Object.values(AcademicLevel) }) @IsIn(Object.values(AcademicLevel)) level: string;
  @ApiProperty() @IsString() @Length(2, 200) institutionName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) boardOrUniversity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) stream?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) degree?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) major?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1980) @Max(2040) yearOfPassing?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isExpectedYear?: boolean;
  @ApiPropertyOptional({ enum: Object.values(ScoreType) }) @IsOptional() @IsIn(Object.values(ScoreType)) scoreType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) scoreValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() certificateDocumentId?: string;
}

export class AcademicInfoDto {
  @ApiProperty({ type: [AcademicRecordDto] })
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AcademicRecordDto)
  records: AcademicRecordDto[];
}

export class SportsInfoDto {
  @ApiProperty() @IsString() @Length(2, 60) primarySport: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) currentClub?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) coachName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) coachContact?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(40) yearsOfTraining?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(50) @Max(260) heightCm?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(15) @Max(250) weightKg?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(50) @Max(300) wingspanCm?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(30) @Max(200) chestCm?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(30) @Max(200) waistCm?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(70) bodyFatPct?: number;
  @ApiPropertyOptional({ enum: Object.values(FitnessLevel) }) @IsOptional() @IsIn(Object.values(FitnessLevel)) fitnessLevel?: string;

  @ApiPropertyOptional({ enum: Object.values(RankingLevel) }) @IsOptional() @IsIn(Object.values(RankingLevel)) rankingLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) rankingValue?: string;
  @ApiPropertyOptional({ enum: Object.values(AgeGroup) }) @IsOptional() @IsIn(Object.values(AgeGroup)) ageGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) bestPerformance?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(999) medalsGold?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(999) medalsSilver?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(999) medalsBronze?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() internationalParticipation?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) internationalDetails?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() previousInjuries?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) injuryDetails?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) recoveryStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() medicalClearanceDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sportsIdDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() coachCertificationDocumentId?: string;
}

export class DocumentLinkDto {
  @ApiProperty({ enum: Object.values(AthleteDocumentType) }) @IsIn(Object.values(AthleteDocumentType)) type: string;
  @ApiProperty() @IsUUID() documentId: string;
}

export class DocumentsDto {
  @ApiProperty({ type: [DocumentLinkDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentLinkDto)
  documents: DocumentLinkDto[];
}

export class ReferenceDto {
  @ApiProperty({ enum: [1, 2] }) @Type(() => Number) @IsIn([1, 2]) position: number;
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiProperty({ enum: ['COACH', 'TRAINER', 'TEACHER', 'SPORTS_OFFICIAL', 'OTHER'] })
  @IsIn(['COACH', 'TRAINER', 'TEACHER', 'SPORTS_OFFICIAL', 'OTHER'])
  designation: string;
  @ApiProperty() @IsString() @Length(2, 160) organization: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) relationship?: string;
  @ApiProperty() @Matches(PHONE) phone: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() certificationDocumentId?: string;
}

export class ReferencesDto {
  @ApiProperty({ type: [ReferenceDto] })
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto)
  references: ReferenceDto[];
}

export class ReviewDto {
  @ApiProperty({ enum: ['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED'] })
  @IsIn(['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED'])
  decision: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

export class VerifyDocumentDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED', 'PENDING'] }) @IsIn(['VERIFIED', 'REJECTED', 'PENDING']) verificationStatus: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class AthleteQuery extends PageQuery {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'VERIFIED', 'CHANGES_REQUESTED', 'REJECTED']) status?: string;
  @IsOptional() @IsString() @MaxLength(60) sport?: string;
}
