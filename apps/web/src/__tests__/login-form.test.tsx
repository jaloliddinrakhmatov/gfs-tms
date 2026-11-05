import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/app/login/login-form';
import { ApiError, login } from '@/lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('next=/billing'),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, login: jest.fn() };
});
const mockedLogin = login as jest.MockedFunction<typeof login>;

describe('<LoginForm />', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows validation errors without calling the API', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('fills credentials from a demo account card', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /accountant/i }));
    expect(screen.getByLabelText('Email')).toHaveValue('accountant@gfs.demo');
  });

  it('signs in and redirects to the requested page', async () => {
    mockedLogin.mockResolvedValue({
      accessToken: 't',
      user: { id: '1', email: 'dispatcher@gfs.demo', name: 'Sarah Chen', role: 'DISPATCHER', driverId: null },
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/billing'));
    expect(mockedLogin).toHaveBeenCalledWith('dispatcher@gfs.demo', 'Demo1234!');
  });

  it('surfaces API errors', async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
