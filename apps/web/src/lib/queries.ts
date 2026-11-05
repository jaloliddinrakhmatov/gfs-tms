'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import { newIdempotencyKey } from './utils';
import type {
  Availability,
  BillingSummary,
  Customer,
  Driver,
  DriverStatus,
  Equipment,
  Invoice,
  InvoiceDetail,
  InvoiceStatus,
  Location,
  Overview,
  Paginated,
  PaymentMethod,
  Priority,
  Quote,
  Shipment,
  ShipmentDetail,
  ShipmentStatus,
  Vehicle,
  VehicleStatus,
} from './types';

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const qk = {
  overview: ['analytics', 'overview'] as const,
  shipments: (p?: object) => ['shipments', 'list', p ?? {}] as const,
  shipmentCounts: ['shipments', 'counts'] as const,
  shipment: (id: string) => ['shipments', 'detail', id] as const,
  locations: ['locations'] as const,
  customerOptions: ['customers', 'options'] as const,
  customers: (p?: object) => ['customers', 'list', p ?? {}] as const,
  availability: (p: object) => ['fleet', 'availability', p] as const,
  vehicles: (p?: object) => ['fleet', 'vehicles', p ?? {}] as const,
  drivers: (p?: object) => ['fleet', 'drivers', p ?? {}] as const,
  invoices: (p?: object) => ['invoices', 'list', p ?? {}] as const,
  invoice: (id: string) => ['invoices', 'detail', id] as const,
  billingSummary: ['invoices', 'summary'] as const,
  quote: (p: object) => ['quote', p] as const,
};

const onError = (title: string) => (err: unknown) =>
  toast.error(title, { description: err instanceof ApiError ? err.message : 'Something went wrong' });

// ───────────── queries ─────────────

export const useOverview = () =>
  useQuery({ queryKey: qk.overview, queryFn: () => api<Overview>('/analytics/overview'), refetchInterval: 30_000 });

export interface ShipmentListParams extends ListParams {
  status?: ShipmentStatus[];
  priority?: Priority;
}

export const useShipments = (params: ShipmentListParams) =>
  useQuery({
    queryKey: qk.shipments(params),
    queryFn: ({ signal }) => api<Paginated<Shipment>>('/shipments', { query: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });

export const useShipmentCounts = () =>
  useQuery({ queryKey: qk.shipmentCounts, queryFn: () => api<Record<ShipmentStatus, number>>('/shipments/counts') });

export const useShipment = (id: string | null | undefined) =>
  useQuery({
    queryKey: qk.shipment(id ?? ''),
    queryFn: () => api<ShipmentDetail>(`/shipments/${id}`),
    enabled: !!id,
  });

export const useLocations = () =>
  useQuery({ queryKey: qk.locations, queryFn: () => api<Location[]>('/locations'), staleTime: Infinity });

export const useCustomerOptions = () =>
  useQuery({
    queryKey: qk.customerOptions,
    queryFn: () => api<{ id: string; name: string; paymentTermsDays: number }[]>('/customers/options'),
    staleTime: 5 * 60_000,
  });

export const useCustomers = (params: ListParams) =>
  useQuery({
    queryKey: qk.customers(params),
    queryFn: () => api<Paginated<Customer>>('/customers', { query: { ...params } }),
    placeholderData: keepPreviousData,
  });

export const useAvailability = (params: { equipment?: Equipment; shipmentId?: string }, enabled = true) =>
  useQuery({
    queryKey: qk.availability(params),
    queryFn: () => api<Availability>('/fleet/availability', { query: params }),
    enabled,
  });

export const useVehicles = (params: ListParams & { status?: VehicleStatus; equipment?: Equipment }) =>
  useQuery({
    queryKey: qk.vehicles(params),
    queryFn: () => api<Paginated<Vehicle>>('/fleet/vehicles', { query: { ...params } }),
    placeholderData: keepPreviousData,
  });

export const useDrivers = (params: ListParams & { status?: DriverStatus }) =>
  useQuery({
    queryKey: qk.drivers(params),
    queryFn: () => api<Paginated<Driver>>('/fleet/drivers', { query: { ...params } }),
    placeholderData: keepPreviousData,
  });

export const useInvoices = (params: ListParams & { status?: InvoiceStatus[] }) =>
  useQuery({
    queryKey: qk.invoices(params),
    queryFn: () => api<Paginated<Invoice>>('/invoices', { query: { ...params } }),
    placeholderData: keepPreviousData,
  });

export const useInvoice = (id: string | null) =>
  useQuery({
    queryKey: qk.invoice(id ?? ''),
    queryFn: () => api<InvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
  });

export const useBillingSummary = () =>
  useQuery({ queryKey: qk.billingSummary, queryFn: () => api<BillingSummary>('/invoices/summary') });

export const useQuote = (p: { originCode?: string; destinationCode?: string; equipment: Equipment; priority: Priority }) =>
  useQuery({
    queryKey: qk.quote(p),
    queryFn: () => api<Quote>('/shipments/quote', { method: 'POST', body: p }),
    enabled: !!p.originCode && !!p.destinationCode && p.originCode !== p.destinationCode,
    staleTime: 10 * 60_000,
  });

// ───────────── mutations ─────────────

export interface CreateShipmentInput {
  customerId: string;
  originCode: string;
  destinationCode: string;
  equipment: Equipment;
  priority: Priority;
  commodity: string;
  weightLbs: number;
  rateCents?: number;
  pickupAt: string;
  deliveryBy: string;
  notes?: string;
}

export function useCreateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShipmentInput) => api<Shipment>('/shipments', { method: 'POST', body: input }),
    onSuccess: (s) => {
      toast.success(`Load ${s.reference} created`, { description: `${s.origin.name} → ${s.destination.name}` });
      void qc.invalidateQueries({ queryKey: ['shipments'] });
      void qc.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: onError('Could not create load'),
  });
}

export function useAssignShipment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { driverId: string; vehicleId: string }) =>
      api<Shipment>(`/shipments/${id}/assign`, { method: 'POST', body: input }),
    onSuccess: (s) => {
      toast.success(`${s.reference} dispatched`, { description: `${s.driver?.name} · ${s.vehicle?.unitNumber}` });
      void qc.invalidateQueries({ queryKey: ['shipments'] });
      void qc.invalidateQueries({ queryKey: ['fleet'] });
      void qc.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: onError('Dispatch failed'),
  });
}

const STATUS_TOAST: Record<string, string> = {
  IN_TRANSIT: 'marked as picked up',
  DELIVERED: 'marked as delivered',
  CANCELLED: 'cancelled',
  PENDING: 'returned to load board',
};

export function useUpdateShipmentStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'; reason?: string }) =>
      api<Shipment>(`/shipments/${id}/status`, { method: 'PATCH', body: input }),
    onSuccess: (s, v) => {
      toast.success(`${s.reference} ${STATUS_TOAST[v.status]}`);
      void qc.invalidateQueries({ queryKey: ['shipments'] });
      void qc.invalidateQueries({ queryKey: ['fleet'] });
      void qc.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: onError('Status update failed'),
  });
}

export function useAddNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api(`/shipments/${id}/notes`, { method: 'POST', body: { message } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.shipment(id) }),
    onError: onError('Could not add note'),
  });
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    // One idempotency key per *attempt*: retries of the same submit reuse it.
    mutationFn: (input: { amountCents: number; method: PaymentMethod; reference?: string; idempotencyKey?: string }) => {
      const { idempotencyKey = newIdempotencyKey(), ...body } = input;
      return api<{ replayed: boolean; invoice: InvoiceDetail }>(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
    retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status < 500),
    onSuccess: ({ invoice }) => {
      toast.success(`Payment recorded on ${invoice.number}`, {
        description: invoice.status === 'PAID' ? 'Invoice is now fully paid' : undefined,
      });
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      void qc.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: onError('Payment failed'),
  });
}

export function useSetVehicleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VehicleStatus }) =>
      api(`/fleet/vehicles/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fleet'] }),
    onError: onError('Could not update truck'),
  });
}

export function useSetDriverStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DriverStatus }) =>
      api(`/fleet/drivers/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fleet'] }),
    onError: onError('Could not update driver'),
  });
}
