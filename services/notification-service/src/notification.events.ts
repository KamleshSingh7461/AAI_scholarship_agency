import { Injectable } from '@nestjs/common';
import {
  Events,
  toMajor,
  type ApplicationStatusChangedEvent,
  type AwardSnapshot,
  type AwardStatusEvent,
  type AwardYearEvent,
  type NotificationRequestedEvent,
  type PaymentEvent,
  type ProfileReviewedEvent,
  type ProfileSubmittedEvent,
  type UserRegisteredEvent,
} from '@aci/contracts';
import { OnEvent, type EventContext } from '@aci/nest-common';
import { NotificationService } from './notification.service';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Translates domain events into athlete-facing messages. */
@Injectable()
export class NotificationEvents {
  constructor(private readonly notify: NotificationService) {}

  @OnEvent(Events.UserRegistered)
  async onUserRegistered(e: UserRegisteredEvent, { tx, event }: EventContext) {
    if (e.role !== 'ATHLETE') return;
    await this.notify.enqueue({ templateKey: 'welcome', channels: ['WHATSAPP'], userId: e.userId, sourceEventId: event.id }, tx);
  }

  @OnEvent(Events.ProfileSubmitted)
  async onProfileSubmitted(e: ProfileSubmittedEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'profile_submitted', channels: ['WHATSAPP', 'EMAIL'], userId: e.userId, data: { name: e.fullName, athleteCode: e.athleteCode }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.ProfileReviewed)
  async onProfileReviewed(e: ProfileReviewedEvent, { tx, event }: EventContext) {
    const status = { VERIFIED: 'Verified ✅', CHANGES_REQUESTED: 'Changes requested', REJECTED: 'Not approved' }[e.status];
    await this.notify.enqueue(
      { templateKey: 'profile_reviewed', channels: ['WHATSAPP'], userId: e.userId, data: { status, remarks: e.remarks ?? '' }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.ApplicationStatusChanged)
  async onApplicationStatus(e: ApplicationStatusChangedEvent, { tx, event }: EventContext) {
    const key: Record<string, string> = {
      SUBMITTED: 'application_submitted',
      FORWARDED_TO_UNIVERSITY: 'application_forwarded',
      REJECTED: 'application_rejected',
      UNIVERSITY_REJECTED: 'application_rejected',
      EXPIRED: 'application_expired',
    };
    if (!key[e.to]) return;
    await this.notify.enqueue(
      { templateKey: key[e.to], channels: ['WHATSAPP'], userId: e.athleteUserId, data: { applicationNo: e.applicationNo, note: e.note ?? '' }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.AwardOffered)
  async onAwardOffered(e: AwardSnapshot & { deadlineDays: number }, { tx, event }: EventContext) {
    await this.notify.enqueue(
      {
        templateKey: 'agreements_ready',
        channels: ['WHATSAPP', 'EMAIL'],
        userId: e.athleteUserId,
        to: { whatsapp: e.whatsappNumber },
        data: { name: e.athleteName, universityName: e.universityName, programName: e.programName, durationYears: e.durationYears, deadlineDays: e.deadlineDays },
        sourceEventId: event.id,
      },
      tx,
    );
  }

  @OnEvent(Events.AwardActivated)
  async onAwardActivated(e: AwardSnapshot, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'award_activated', channels: ['WHATSAPP'], userId: e.athleteUserId, to: { whatsapp: e.whatsappNumber }, data: { awardNo: e.awardNo, universityName: e.universityName }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.AwardRenewalDue)
  async onRenewalDue(e: AwardYearEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'renewal_reminder', channels: ['WHATSAPP', 'EMAIL'], userId: e.athleteUserId, data: { yearNumber: e.yearNumber, dueDate: fmtDate(e.dueDate) }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.AwardRenewalOpened)
  async onRenewalOpened(e: AwardYearEvent & { deadline: string }, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'renewal_open', channels: ['WHATSAPP'], userId: e.athleteUserId, data: { yearNumber: e.yearNumber, deadline: fmtDate(e.deadline) }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.AwardRenewed)
  async onRenewed(e: AwardYearEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'renewal_done', channels: ['WHATSAPP'], userId: e.athleteUserId, data: { yearNumber: e.yearNumber, academicYear: e.academicYear }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.AwardSuspended)
  async onSuspended(e: AwardStatusEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'award_suspended', channels: ['WHATSAPP', 'EMAIL'], userId: e.athleteUserId, data: { awardNo: e.awardNo, reason: e.reason ?? 'renewal not completed' }, sourceEventId: event.id },
      tx,
    );
  }

  @OnEvent(Events.PaymentSucceeded)
  async onPaid(e: PaymentEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      {
        templateKey: 'payment_receipt',
        channels: ['WHATSAPP'],
        userId: e.userId,
        data: { amount: toMajor(e.amount).toLocaleString('en-IN'), purpose: e.purpose === 'APPLICATION_FEE' ? 'scholarship application fee' : 'renewal fee', orderNo: e.orderNo },
        sourceEventId: event.id,
      },
      tx,
    );
  }

  @OnEvent(Events.PaymentFailed)
  async onPaymentFailed(e: PaymentEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: 'payment_failed', channels: ['WHATSAPP'], userId: e.userId, data: { purpose: 'your scholarship application' }, sourceEventId: event.id },
      tx,
    );
  }

  /** Generic hook other services use for ad-hoc messages (e.g. agreement reminders). */
  @OnEvent(Events.NotificationRequested)
  async onRequested(e: NotificationRequestedEvent, { tx, event }: EventContext) {
    await this.notify.enqueue(
      { templateKey: e.templateKey, channels: e.channels, userId: e.userId, to: e.to, data: e.data, sourceEventId: event.id },
      tx,
    );
  }
}
