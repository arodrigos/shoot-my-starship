import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Una Permissions-Policy que desactive screen-wake-lock anularía la mejora
// sin ningún error visible. Se lee el texto de la configuración (importarla
// arrastraría el plugin del service worker).
test("pe-5: ninguna cabecera Permissions-Policy desactiva screen-wake-lock", async () => {
  const fuente = await readFile("next.config.ts", "utf8");
  for (const [i, linea] of fuente.split("\n").entries()) {
    if (!/permissions-policy|feature-policy/i.test(linea) && !/screen-wake-lock/i.test(linea)) continue;
    assert.doesNotMatch(
      linea,
      /screen-wake-lock\s*=\s*\((?!\s*(self|\*)\s*\))/i,
      `next.config.ts:${i + 1}: la cabecera Permissions-Policy desactiva screen-wake-lock`,
    );
  }
  for (const m of fuente.matchAll(/permissions-policy[\s\S]{0,200}/gi)) {
    assert.doesNotMatch(m[0], /screen-wake-lock\s*=\s*\(\s*\)/i, "la cabecera Permissions-Policy desactiva screen-wake-lock");
  }
});
