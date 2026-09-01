export function accountStateFromUser(user, now = Date.now()) {
  return {
    habilitado: user?.habilitado !== false,
    intentos_fallidos: Number(user?.intentos_fallidos || 0),
    bloqueado_temporalmente: Boolean(
      user?.bloqueado_hasta && Date.parse(user.bloqueado_hasta) > now,
    ),
  };
}

export function accountStatesByUser(users, now = Date.now()) {
  return Object.fromEntries(
    users.map((user) => [user.id_usuario, accountStateFromUser(user, now)]),
  );
}
