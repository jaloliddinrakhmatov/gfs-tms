import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const shipmentSchema = z
  .object({
    customerId: z.string().min(1, 'Select a customer'),
    originCode: z.string().min(1, 'Select an origin'),
    destinationCode: z.string().min(1, 'Select a destination'),
    equipment: z.enum(['DRY_VAN', 'REEFER', 'FLATBED']),
    priority: z.enum(['STANDARD', 'EXPEDITED']),
    commodity: z.string().trim().min(2, 'Describe the commodity').max(80),
    weightLbs: z.coerce
      .number({ invalid_type_error: 'Enter weight' })
      .int('Whole pounds only')
      .min(100, 'Minimum 100 lbs')
      .max(48_000, 'Exceeds legal trailer limit (48,000 lbs)'),
    rate: z
      .union([z.literal(''), z.coerce.number().min(100, 'Minimum $100').max(50_000, 'Maximum $50,000')])
      .optional(),
    pickupAt: z.string().min(1, 'Pick a pickup time'),
    deliveryBy: z.string().min(1, 'Pick a delivery deadline'),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.originCode !== v.destinationCode, {
    path: ['destinationCode'],
    message: 'Destination must differ from origin',
  })
  .refine((v) => !v.pickupAt || !v.deliveryBy || new Date(v.deliveryBy) > new Date(v.pickupAt), {
    path: ['deliveryBy'],
    message: 'Delivery must be after pickup',
  });
export type ShipmentFormInput = z.input<typeof shipmentSchema>;
export type ShipmentFormValues = z.output<typeof shipmentSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be positive'),
  method: z.enum(['ACH', 'WIRE', 'CARD', 'CHECK']),
  reference: z.string().max(80).optional(),
});
export type PaymentFormInput = z.input<typeof paymentSchema>;
export type PaymentFormValues = z.output<typeof paymentSchema>;
