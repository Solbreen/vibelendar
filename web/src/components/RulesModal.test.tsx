import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RulesModal } from './RulesModal.js';

afterEach(cleanup);

it('показывает правила и закрывается кнопкой или Escape', () => {
  const onClose = vi.fn();
  render(<RulesModal onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Правила выбора дней отпуска' })).toBeTruthy();
  expect(screen.getByText('Правила пересечения отпусков')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(2);
});
