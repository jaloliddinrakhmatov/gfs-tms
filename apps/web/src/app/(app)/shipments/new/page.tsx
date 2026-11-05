'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ShipmentForm } from '@/components/shipments/shipment-form';

export default function NewShipmentPage() {
  return (
    <div className="space-y-5 stagger">
      <Link href="/shipments" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Shipments
      </Link>
      <PageHeader title="Tender a new load" description="Real road routing and an instant spot quote as you type." />
      <ShipmentForm />
    </div>
  );
}
