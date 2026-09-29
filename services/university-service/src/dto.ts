import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CostBearer, CoverageType, Currency, FeePercentBase, FeeType, RolloverPolicy, ScholarshipType } from '@aci/contracts';
import { PageQuery } from '@aci/nest-common';

const ACADEMIC_YEAR = /^\d{4}-\d{2}$/;
const bearers = Object.values(CostBearer);

export class CreateUniversityDto {
  @ApiProperty() @IsString() @Length(2, 200) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
}

export class UpdateUniversityDto extends PartialType(CreateUniversityDto) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] }) @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class CreateAgreementDto {
  @ApiProperty({ enum: ['ESTABLISHMENT', 'SCHOLARSHIP_TRANSFER', 'VALUATION', 'OTHER'] })
  @IsIn(['ESTABLISHMENT', 'SCHOLARSHIP_TRANSFER', 'VALUATION', 'OTHER'])
  type: string;
  @ApiProperty() @IsString() @Length(2, 200) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) referenceNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() signedDate?: string;
  @ApiProperty() @IsDateString() effectiveDate: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) termYears?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoRenew?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) renewalTermYears?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) noticePeriodMonths?: number;
  @ApiPropertyOptional({ description: 'basis points, 8000 = 80%' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) universityRevenueShareBps?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) companyRevenueShareBps?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) agencyCommissionBps?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) universityCommissionShareBps?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class UpdateAgreementDto extends PartialType(CreateAgreementDto) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXPIRED', 'TERMINATED'] }) @IsOptional() @IsIn(['ACTIVE', 'EXPIRED', 'TERMINATED']) status?: string;
}

export class CreateAllocationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() agreementId?: string;
  @ApiProperty({ example: '2025-26' }) @Matches(ACADEMIC_YEAR) academicYear: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(100000) totalSeats: number;
  @ApiProperty({ enum: Object.values(RolloverPolicy) }) @IsIn(Object.values(RolloverPolicy)) rolloverPolicy: string;
  @ApiPropertyOptional({ description: 'minor units' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) valuationPerSeatAnnual?: number;
  @ApiPropertyOptional({ enum: Object.values(Currency) }) @IsOptional() @IsIn(Object.values(Currency)) valuationCurrency?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() transferLetterDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() valuationLetterDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class UpdateAllocationDto extends PartialType(CreateAllocationDto) {}

/** All money fields are integers in minor units (paise / cents). */
export class CreateProgramDto {
  @ApiProperty() @IsUUID() universityId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() allocationId?: string;
  @ApiProperty() @IsString() @Length(3, 200) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiProperty({ enum: Object.values(ScholarshipType) }) @IsIn(Object.values(ScholarshipType)) scholarshipType: string;
  @ApiProperty({ enum: Object.values(CoverageType) }) @IsIn(Object.values(CoverageType)) coverageType: string;
  @ApiProperty({ enum: [1, 2, 3, 4, 5] }) @Type(() => Number) @IsInt() @Min(1) @Max(6) durationYears: number;
  @ApiProperty({ example: '2026-27' }) @Matches(ACADEMIC_YEAR) academicYear: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() intakeDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() applicationOpensAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() applicationClosesAt?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) eligibleSports?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) eligibilityCriteria?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(60) minAge?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(60) maxAge?: number;
  @ApiPropertyOptional({ enum: ['ANY', 'MALE', 'FEMALE'] }) @IsOptional() @IsIn(['ANY', 'MALE', 'FEMALE']) genderEligibility?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) courses?: string[];

  @ApiProperty({ enum: Object.values(Currency) }) @IsIn(Object.values(Currency)) currency: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) tuitionFullPerYear: number;
  @ApiProperty({ description: 'bps, 5000 = 50%' }) @Type(() => Number) @IsInt() @Min(0) @Max(10000) tuitionCoverageBps: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) roomPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) foodPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) otherPerYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) otherCostsNote?: string;
  @ApiPropertyOptional({ enum: bearers }) @IsOptional() @IsIn(bearers) tuitionBorneBy?: string;
  @ApiPropertyOptional({ enum: bearers }) @IsOptional() @IsIn(bearers) roomBorneBy?: string;
  @ApiPropertyOptional({ enum: bearers }) @IsOptional() @IsIn(bearers) foodBorneBy?: string;
  @ApiPropertyOptional({ enum: bearers }) @IsOptional() @IsIn(bearers) otherBorneBy?: string;

  @ApiProperty({ enum: Object.values(FeeType) }) @IsIn(Object.values(FeeType)) feeType: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) feeFlatInr?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) feePercentBps?: number;
  @ApiPropertyOptional({ enum: Object.values(FeePercentBase) }) @IsOptional() @IsIn(Object.values(FeePercentBase)) feePercentBase?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) feeMinInr?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) feeMaxInr?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5000) taxBps?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() feeRefundableOnRejection?: boolean;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) commissionBps?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) universityCommissionShareBps?: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(100000) seatsTotal: number;
}

export class UpdateProgramDto extends PartialType(CreateProgramDto) {}

export class ProgramQuery extends PageQuery {
  @IsOptional() @IsUUID() universityId?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() durationYears?: number;
  @IsOptional() @IsString() sport?: string;
}

export class CatalogQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(60) sport?: string;
  @IsOptional() @IsString() @MaxLength(120) university?: string;
  @IsOptional() @Type(() => Number) @IsInt() durationYears?: number;
}

export class SeatDto {
  @IsOptional() @IsUUID() programId?: string;
  @IsUUID() applicationId: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
