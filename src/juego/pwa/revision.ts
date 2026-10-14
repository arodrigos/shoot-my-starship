export interface EntornoRevision {
  readonly shaDespliegue?: string | undefined;
  readonly salidaGit?: string | null | undefined;
}

// Revisión con la que se versiona el precache de "/" y del manifiesto: si no
// cambia entre builds, el service worker nuevo seguiría sirviendo el HTML
// viejo. El "??" no sirve aquí porque Vercel y git pueden devolver cadena
// vacía, que es justo la que dejaría el precache sin versión.
export function calcularRevision(entorno: EntornoRevision, uuid: () => string): string {
  for (const candidata of [entorno.shaDespliegue, entorno.salidaGit]) {
    const limpia = candidata?.trim().split(/\s+/)[0];
    if (limpia) return limpia;
  }
  return uuid();
}
