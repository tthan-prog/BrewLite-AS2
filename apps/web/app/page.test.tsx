import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('hiển thị tên ứng dụng và liên kết tới menu', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'BrewLite' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem menu' })).toHaveAttribute('href', '/menu');
  });
});
