// Tamaño lógico del mundo del juego, fijo con independencia del tamaño de
// pantalla o del dispositivo. Es lo que hace posible el criterio andamiaje-1:
// el mismo gesto relativo produce la misma coordenada de mundo a 360 px y a
// 1280 px de ancho. Los bloques de terreno y render reutilizan estas mismas
// constantes en vez de declarar su propio tamaño de mundo.
export const MUNDO_ANCHO = 1920;
export const MUNDO_ALTO = 1080;
