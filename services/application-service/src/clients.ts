import { Injectable } from '@nestjs/common';
import type { AgreementType, Currency, FeeQuote } from '@aci/contracts';
import { InternalHttpClient } from '@aci/nest-common';

export interface AthleteSummary {
  profileId: string;
  userId: string;
  athleteCode: string;
  status: string;
  fullName: string | null;
  dateOfBirth: string | null;
  age: number | null;
  isMinor: boolean;
  gender: string | null;
  email: string | null;
  phone: string;
  whatsappNumber: string;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  guardian: { name: string; relation?: string; phone?: string; email?: string } | null;
}

export interface ProgramView {
  id: string;
  code: string;
  slug: string;
  name: string;
  universityId: string;
  university: { id: string; name: string; status: string } | null;
  academicYear: string;
  durationYears: number;
  intakeDate: string | null;
  status: string;
  isOpen: boolean;
  seatsLeft: number;
  eligibleSports: string[];
  minAge: number | null;
  maxAge: number | null;
  genderEligibility: string;
  commissionBps: number;
  universityCommissionShareBps: number;
  feeRefundableOnRejection: boolean;
  value: {
    currency: Currency;
    tuitionPerYear: number;
    roomPerYear: number;
    foodPerYear: number;
    otherPerYear: number;
    annualValue: number;
    totalValue: number;
    universityFundedAnnual: number;
    companyFundedAnnual: number;
    usdInrRate4: number;
  };
  fee: FeeQuote;
}

export interface EnvelopeRequest {
  agreementType: AgreementType;
  referenceType: 'AWARD' | 'AWARD_YEAR';
  referenceId: string;
  signer: { userId: string; name: string; email: string; phone: string };
  guardian?: { name: string; email?: string; phone?: string } | null;
  mergeFields: Record<string, string | number>;
  expiresInDays: number;
}

/** Typed wrappers around the synchronous internal APIs this service depends on. */
@Injectable()
export class Clients {
  constructor(private readonly http: InternalHttpClient) {}

  athleteByUser(userId: string) {
    return this.http.get<AthleteSummary>('athlete', `/internal/athletes/by-user/${userId}`);
  }

  program(id: string) {
    return this.http.get<ProgramView>('university', `/internal/programs/${id}`);
  }

  reserveSeat(programId: string, applicationId: string) {
    return this.http.post('university', '/internal/seats/reserve', { programId, applicationId }, { retry: true });
  }

  confirmSeat(applicationId: string) {
    return this.http.post('university', '/internal/seats/confirm', { applicationId }, { retry: true });
  }

  releaseSeat(applicationId: string, reason: string) {
    return this.http.post('university', '/internal/seats/release', { applicationId, reason }, { retry: true });
  }

  returnSeat(applicationId: string, reason: string) {
    return this.http.post('university', '/internal/seats/return', { applicationId, reason }, { retry: true });
  }

  createPaymentOrder(body: {
    purpose: 'APPLICATION_FEE' | 'RENEWAL_FEE';
    referenceType: string;
    referenceId: string;
    userId: string;
    amount: number;
    taxAmount: number;
    description: string;
    customer: { name: string; phone: string; email?: string | null };
  }) {
    return this.http.post<{ orderId: string; orderNo: string; provider: string; status: string; checkout: Record<string, unknown> }>(
      'payment',
      '/internal/orders',
      body,
      { retry: true },
    );
  }

  requestRefund(orderId: string, reason: string) {
    return this.http.post('payment', `/internal/orders/${orderId}/refund`, { reason }, { retry: true });
  }

  createEnvelope(req: EnvelopeRequest) {
    return this.http.post<{ id: string; status: string }>('esign', '/internal/envelopes', req, { timeoutMs: 30_000 });
  }

  voidEnvelope(id: string, reason: string) {
    return this.http.post('esign', `/internal/envelopes/${id}/void`, { reason }, { retry: true });
  }
}
