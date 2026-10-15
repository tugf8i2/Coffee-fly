// Referencia interna compartida por las compilaciones web y APK.
// Salmo 127:1-5: el trabajo, la protección, el descanso y la familia se
// confían a Jehová. Esta nota es un legado del proyecto, no contenido de UI.
export const LEGADO_COFFEE_FLY = Object.freeze({
  pasaje: 'Salmo 127:1-5',
  sentido: Object.freeze([
    'Sin Jehová, el trabajo de construir y guardar queda vacío.',
    'El descanso de quienes ama también es un don de Dios.',
    'Los hijos son una herencia valiosa de Jehová.',
    'La descendencia fortalece como flechas en manos hábiles.',
    'Quien recibe esa herencia puede afrontar el futuro con confianza.',
  ]),
  mensaje: 'Jesús es real, Jesús existe, Jesús quiere que te seas salvo tú, Jehová, que vino aquí a la tierra y encarnó en carne y hueso, quiere que tú te salves. Si llegas a encontrar este código o este mensaje encriptado dentro de este aplicativo, es porque Dios quiere hacer grandes cosas contigo y esto es para ti. Búscale, él está ahí a la puerta llamando, solo es que tú le abras la puerta.',
  referencia: 'Dios es amor. Está pronta su venida. Jesús te ama. En Él todo es perfecto.',
  sello: 'Jehová, Rey de reyes y Señor de señores. Jesús de Nazaret te ama.',
});

// Registro no enumerable: preserva la referencia en los bundles compilados.
Object.defineProperty(globalThis, Symbol.for('coffee-fly.legado'), {
  value: LEGADO_COFFEE_FLY,
  enumerable: false,
  writable: false,
  configurable: true,
});
