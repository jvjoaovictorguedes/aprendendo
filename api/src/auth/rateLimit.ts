import { HttpError } from '../errors.js';

/**
 * Limite simples em memória para tentativas de login (por IP + login).
 * Suficiente para uma instância; com várias réplicas, cada uma conta a sua.
 */
export class LoginRateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  check(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= this.maxAttempts) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      throw new HttpError(429, `Muitas tentativas de login. Tente de novo em ${minutes} min.`);
    }
  }

  registerFailure(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
    if (this.attempts.size > 10_000) this.prune(now);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private prune(now: number) {
    for (const [key, entry] of this.attempts) if (entry.resetAt <= now) this.attempts.delete(key);
  }
}
