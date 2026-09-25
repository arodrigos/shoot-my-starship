// Mensaje de andamiaje-4: qué ha pasado y qué puede hacer el jugador, nunca
// un lienzo negro ni una excepción sin capturar.
export function SinWebGL() {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        padding: "2rem",
        textAlign: "center",
        color: "#f2f2f2",
        backgroundColor: "#12141a",
      }}
    >
      <p style={{ margin: 0, fontSize: "1.1rem" }}>
        Este navegador no puede mostrar gráficos WebGL, y Shoot my starship los necesita para
        funcionar.
      </p>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Prueba a actualizar el navegador, comprobar que la aceleración por hardware está
        activada en sus ajustes, o abrir este enlace en otro navegador (Chrome o Firefox
        recientes suelen ir bien).
      </p>
    </div>
  );
}
