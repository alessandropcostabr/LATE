const { validatePassword } = require('../utils/passwordPolicy');

describe('validatePassword', () => {
  it('aceita senha com letras e números suficientes', () => {
    const result = validatePassword('Guardiao987', { email: 'usuario@example.com' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('recusa senhas curtas', () => {
    const result = validatePassword('Abc123', { email: 'usuario@example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A senha deve ter pelo menos 8 caracteres.');
  });

  it('exige mistura de letras e números', () => {
    expect(validatePassword('SomenteLetras', {}).valid).toBe(false);
    expect(validatePassword('12345678', {}).valid).toBe(false);
  });

  it('bloqueia palavras comuns e sequências', () => {
    const result = validatePassword('Senha1234', {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes('palavras comuns'))).toBe(true);
  });

  it('impede reutilizar partes do e-mail', () => {
    const result = validatePassword('Usuario2024', { email: 'usuario@example.com' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes('partes do seu e-mail'))).toBe(true);
  });

  it('identifica datas de aniversário no conteúdo', () => {
    const result = validatePassword('Segura01012024', {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes('datas de aniversário'))).toBe(true);
  });
});
