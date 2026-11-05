export const BILLING_QUEUE = 'billing';

export const BillingJobs = {
  GENERATE_INVOICE: 'generate-invoice',
  MARK_OVERDUE: 'mark-overdue',
} as const;

export interface GenerateInvoiceJob {
  shipmentId: string;
}
