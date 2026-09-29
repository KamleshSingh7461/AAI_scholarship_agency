import { Injectable, Logger } from '@nestjs/common';
import { Events, type EnvelopeEvent, type PaymentEvent } from '@aci/contracts';
import { OnEvent, type EventContext } from '@aci/nest-common';
import { ApplicationService } from './application.service';
import { AwardService } from './award.service';

@Injectable()
export class ApplicationEventHandlers {
  private readonly logger = new Logger(ApplicationEventHandlers.name);

  constructor(
    private readonly applications: ApplicationService,
    private readonly awards: AwardService,
  ) {}

  @OnEvent(Events.PaymentSucceeded)
  async onPaymentSucceeded(e: PaymentEvent, { tx }: EventContext) {
    if (e.purpose !== 'APPLICATION_FEE' || e.referenceType !== 'APPLICATION') return;
    await this.applications.markPaid(tx, e.referenceId, e.orderId, new Date(e.occurredAt));
  }

  @OnEvent(Events.PaymentRefunded)
  async onRefunded(e: PaymentEvent, { tx }: EventContext) {
    if (e.referenceType !== 'APPLICATION') return;
    await tx.application.updateMany({ where: { id: e.referenceId }, data: { paymentStatus: 'REFUNDED' } });
  }

  @OnEvent(Events.EnvelopeSigned)
  async onEnvelopeSigned(e: EnvelopeEvent, { tx }: EventContext) {
    await this.awards.onEnvelopeSigned(tx, e);
  }

  @OnEvent(Events.EnvelopeDeclined)
  async onEnvelopeDeclined(e: EnvelopeEvent, { tx }: EventContext) {
    if (e.referenceType !== 'AWARD') return;
    const award = await tx.award.findUnique({ where: { id: e.referenceId } });
    if (!award) return;
    await tx.applicationNote.create({
      data: {
        applicationId: award.applicationId,
        authorId: e.signerUserId,
        authorName: 'System',
        body: `Athlete DECLINED the ${e.agreementType === 'AGENCY' ? 'Agency Agreement' : 'Scholarship Award Agreement'}. Contact them, then use "Resend agreements" or revoke the offer.`,
      },
    });
    this.logger.warn(`Envelope declined for award ${award.awardNo}`);
  }
}
