import { isValidPassword } from '../src/servicios/politicaContrasena';

test.each(['Abcdefg', 'Admin123', 'Árboles', 'Aa' + 'x'.repeat(18)])('acepta contraseña válida %s', (password) => {
  expect(isValidPassword(password)).toBe(true);
});
test.each(['', 'Abcdef', 'abcdefg', 'ABCDEFG', '1234567', 'Aa' + 'x'.repeat(19)])('rechaza contraseña inválida %s', (password) => {
  expect(isValidPassword(password)).toBe(false);
});
