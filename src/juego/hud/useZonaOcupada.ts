"use client";

import { useEffect, useRef, type RefObject } from "react";
import { engancharToquesHud, medirZona, observarZona, publicarZona, type IdZona } from "@/juego/camara/zonasOcupadas";

// Publica la zona que ocupa un elemento del HUD. Un ResizeObserver no avisa si
// el elemento solo cambia de sitio (la consola pasa de un anclaje a otro con el
// mismo tamaño) ni si se aparta con opacidad, así que además se vuelve a medir
// en cada render del componente, que es cuando cambia cualquiera de las dos.
export function useZonaOcupada(id: IdZona, ref: RefObject<HTMLElement | null>, visible: boolean): void {
  const visibleRef = useRef(visible);
  // La ref se actualiza en un efecto: escribirla durante el render no es puro.
  useEffect(() => {
    visibleRef.current = visible;
  });

  useEffect(() => {
    const elemento = ref.current;
    if (elemento === null) return;
    engancharToquesHud();
    return observarZona(id, elemento, () => visibleRef.current);
  }, [id, ref]);

  useEffect(() => {
    const elemento = ref.current;
    if (elemento === null) return;
    publicarZona(id, { ...medirZona(elemento), visible });
  });
}
