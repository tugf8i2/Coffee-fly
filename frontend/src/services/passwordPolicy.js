export const PASSWORD_HELP = 'Entre 7 y 20 caracteres, con una mayúscula y una minúscula.';
export function isValidPassword(value) {
  return [...value].length >= 7 && [...value].length <= 20 && /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value);
}
