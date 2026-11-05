import { createColumnHelper } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/data-table/data-table';

type Row = { id: string; name: string; amount: number };
const col = createColumnHelper<Row>();
const columns = [col.accessor('name', { header: 'Name' }), col.accessor('amount', { header: 'Amount' })];
const rows: Row[] = [
  { id: '1', name: 'Northwind', amount: 10 },
  { id: '2', name: 'Apex', amount: 20 },
];

describe('<DataTable />', () => {
  it('renders server rows and a range summary', () => {
    render(
      <DataTable columns={columns} data={rows} total={42} pageCount={3} pagination={{ pageIndex: 0, pageSize: 20 }} onPaginationChange={() => {}} />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
    expect(screen.getByText('Northwind')).toBeInTheDocument();
    expect(screen.getByText('1–20')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('requests the next page and toggles server-side sorting', async () => {
    const onPage = jest.fn();
    const onSort = jest.fn();
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={rows}
        total={42}
        pageCount={3}
        pagination={{ pageIndex: 0, pageSize: 20 }}
        onPaginationChange={onPage}
        sorting={[]}
        onSortingChange={onSort}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 20 });

    const header = screen.getAllByRole('columnheader')[1];
    await user.click(within(header).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith([{ id: 'amount', desc: expect.any(Boolean) }]);
  });

  it('shows the empty state', () => {
    render(
      <DataTable columns={columns} data={[]} total={0} pageCount={1} pagination={{ pageIndex: 0, pageSize: 20 }} onPaginationChange={() => {}} empty={<p>Nothing here</p>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
