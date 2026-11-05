import { render, screen } from '@testing-library/react';
import { InvoiceStatusBadge, ShipmentStatusBadge } from '@/components/status-badges';

describe('status badges', () => {
  it('renders human labels for shipment statuses', () => {
    render(<ShipmentStatusBadge status="IN_TRANSIT" />);
    expect(screen.getByText('In transit')).toBeInTheDocument();
  });

  it('uses danger styling for overdue invoices', () => {
    render(<InvoiceStatusBadge status="OVERDUE" />);
    expect(screen.getByText('Overdue').className).toMatch(/rose/);
  });
});
