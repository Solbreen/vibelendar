import { useState } from 'react';
import { Modal } from './Modal.js';
interface Props { busy: boolean; serverError: string | null; onSubmit: (password: string) => void; }
export function LoginModal({ busy, serverError, onSubmit }: Props): JSX.Element {
  const [password, setPassword] = useState('');
  return <Modal title="Вход" footer={<button type="submit" form="login-form" className="button button--primary" disabled={busy || !password}>{busy ? 'Входим…' : 'Войти'}</button>}>
    <form id="login-form" onSubmit={(event) => { event.preventDefault(); onSubmit(password); }}>
      <label htmlFor="login-password">Пароль</label>
      <input id="login-password" type="password" className="input" autoComplete="current-password" autoFocus maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} />
      {serverError ? <p className="fieldError" role="alert">{serverError}</p> : null}
    </form>
  </Modal>;
}
