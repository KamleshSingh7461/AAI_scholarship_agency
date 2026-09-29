import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Cron } from '@nestjs/schedule';
import type { Request, Response } from 'express';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, STAFF_ROLES } from '@aci/contracts';
import { API, APP_CONFIG, CurrentUser, Internal, PageQuery, Public, RedisService, Roles, toPage, type AuthUser } from '@aci/nest-common';
import type { PaymentConfig } from './config';
import { PaymentService, type CreateOrderInput } from './payment.service';
import { PrismaService } from './prisma.service';
import { PayuGateway } from './gateways/payu.gateway';
import type { Prisma } from './generated/prisma';

class RefundDto {
  @IsString() @Length(3, 500) reason: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) amount?: number;
}

class PaymentQuery extends PageQuery {
  @IsOptional() @IsIn(['CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED']) status?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() referenceId?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@ApiTags('payments')
@Controller(`${API}/payments`)
export class PaymentController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: PaymentConfig,
    private readonly svc: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('mine')
  async mine(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    const where = { userId: u.id, status: { not: 'CREATED' } };
    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.paymentOrder.count({ where }),
    ]);
    return toPage(items.map((o) => this.svc.view(o)), total, q);
  }

  @Roles(Role.ADMIN, Role.FINANCE)
  @Get('summary')
  summary() {
    return this.svc.summary();
  }

  @Roles(Role.ADMIN, Role.FINANCE, Role.REVIEWER)
  @Get()
  async list(@Query() q: PaymentQuery) {
    const where: Prisma.PaymentOrderWhereInput = {
      ...(q.status ? { status: q.status } : { status: { not: 'CREATED' } }),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.referenceId ? { referenceId: q.referenceId } : {}),
      ...(q.q ? { OR: [{ orderNo: { contains: q.q, mode: 'insensitive' } }, { providerPaymentId: { contains: q.q } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.pageSize, include: { refunds: true } }),
      this.prisma.paymentOrder.count({ where }),
    ]);
    return toPage(items.map((o) => ({ ...this.svc.view(o), customer: o.customer, refunds: o.refunds })), total, q);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.svc.view(await this.svc.getForUser(id, u, STAFF_ROLES.includes(u.role)));
  }

  /** GST-ready receipt data (the student portal renders it as a printable page). */
  @Get(':id/receipt')
  async receipt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    const o = await this.svc.getForUser(id, u, STAFF_ROLES.includes(u.role));
    if (!['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(o.status)) throw new NotFoundException({ message: 'No receipt for unpaid orders' });
    const e = this.config.env;
    return {
      receiptNo: o.orderNo,
      issuedAt: o.paidAt,
      seller: { legalName: e.COMPANY_LEGAL_NAME, brand: e.COMPANY_BRAND_NAME, gstin: e.COMPANY_GSTIN ?? null, address: e.COMPANY_ADDRESS ?? null },
      customer: o.customer,
      description: o.description,
      baseAmount: Number(o.amount) - Number(o.taxAmount),
      taxAmount: Number(o.taxAmount),
      total: Number(o.amount),
      currency: o.currency,
      provider: o.provider,
      providerPaymentId: o.providerPaymentId,
      refundedAmount: Number(o.refundedAmount),
    };
  }

  /** Called by the student portal after the gateway redirects/closes. */
  @Post(':id/verify')
  @HttpCode(200)
  async verify(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, string>, @CurrentUser() u: AuthUser) {
    const o = await this.svc.getForUser(id, u, false);
    return this.svc.view(await this.svc.verifyReturn(o, body ?? {}));
  }

  @Roles(Role.ADMIN, Role.FINANCE)
  @Post(':id/refund')
  @HttpCode(200)
  async refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto, @CurrentUser() u: AuthUser) {
    return this.svc.view(await this.svc.refund(id, dto.reason, u, dto.amount));
  }
}

/** Gateway → us. Public, but every payload is signature-verified. */
@ApiTags('payments (webhooks)')
@Controller(`${API}/payments`)
@Public()
export class PaymentWebhookController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: PaymentConfig,
    private readonly svc: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhooks/:provider')
  @HttpCode(200)
  async webhook(@Param('provider') provider: string, @Req() req: RawBodyRequest<Request>) {
    if (provider.toUpperCase() !== this.svc.gateway.name) throw new NotFoundException();
    return this.svc.handleWebhook(req.headers, req.rawBody ?? Buffer.from(''));
  }

  /** PayU posts the browser back here (surl/furl). We verify, then redirect into the student portal. */
  @Post('payu/callback')
  async payuCallback(@Req() req: Request, @Res() res: Response) {
    const body = req.body as Record<string, string>;
    const order = body?.udf1 ? await this.prisma.paymentOrder.findUnique({ where: { id: body.udf1 } }) : null;
    if (order && this.svc.gateway instanceof PayuGateway) {
      await this.svc.verifyReturn(order, body).catch(() => undefined);
    }
    res.redirect(303, `${this.config.studentWebUrl}/payments/return?orderId=${order?.id ?? ''}`);
  }

  // ------------------------- Local mock checkout -------------------------

  @ApiExcludeEndpoint()
  @Get('mock/checkout/:id')
  @Header('content-type', 'text/html; charset=utf-8')
  async mockCheckout(@Param('id', ParseUUIDPipe) id: string) {
    if (this.config.isProd || this.svc.gateway.name !== 'MOCK') throw new ForbiddenException();
    const o = await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id } });
    const amount = (Number(o.amount) / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock payment</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f6fb;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#fff;border-radius:16px;padding:32px;max-width:380px;width:calc(100% - 32px);box-shadow:0 10px 30px rgba(0,0,0,.08)}
h1{font-size:18px;margin:0 0 4px}.muted{color:#667;font-size:13px}.amt{font-size:32px;font-weight:700;margin:20px 0}
button{width:100%;padding:14px;border:0;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:10px}
.pay{background:#16a34a;color:#fff}.fail{background:#fee2e2;color:#b91c1c}.tag{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;padding:3px 8px;border-radius:99px}</style></head>
<body><div class="card"><span class="tag">TEST MODE — no real money</span><h1 style="margin-top:12px">${esc(this.config.env.COMPANY_BRAND_NAME)}</h1>
<div class="muted">${esc(o.description)}</div><div class="amt">${amount}</div><div class="muted">Order ${esc(o.orderNo)}</div>
<form method="post" action="/api/v1/payments/mock/${o.id}/complete"><input type="hidden" name="outcome" value="success"><button class="pay">Pay ${amount}</button></form>
<form method="post" action="/api/v1/payments/mock/${o.id}/complete"><input type="hidden" name="outcome" value="failure"><button class="fail">Simulate failure</button></form>
</div></body></html>`;
  }

  @ApiExcludeEndpoint()
  @Post('mock/:id/complete')
  async mockComplete(@Param('id', ParseUUIDPipe) id: string, @Body() body: { outcome?: string }, @Res() res: Response) {
    if (this.config.isProd || this.svc.gateway.name !== 'MOCK') throw new ForbiddenException();
    if (body?.outcome === 'success') await this.svc.markPaid(id, `mock_pay_${Date.now()}`);
    else await this.svc.markFailed(id, 'Simulated failure');
    res.redirect(303, `${this.config.studentWebUrl}/payments/return?orderId=${id}`);
  }
}

@Controller('internal/orders')
@Internal()
export class InternalPaymentController {
  constructor(private readonly svc: PaymentService) {}

  @Post()
  @HttpCode(200)
  create(@Body() body: CreateOrderInput) {
    return this.svc.createOrder(body);
  }

  @Post(':id/refund')
  @HttpCode(200)
  async refund(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string; amount?: number }) {
    return this.svc.view(await this.svc.refund(id, body.reason ?? 'refund', null, body.amount));
  }
}

/** Every 5 minutes: poll gateways for orders whose webhooks were missed. One replica at a time. */
@Injectable()
export class ReconciliationJob {
  constructor(
    private readonly svc: PaymentService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 */5 * * * *')
  async run() {
    await this.redis.withLock('payment-reconcile', 4 * 60_000, () => this.svc.reconcile());
  }
}
