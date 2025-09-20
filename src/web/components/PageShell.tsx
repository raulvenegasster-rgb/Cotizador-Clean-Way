import React from "react";
import HeroBackground from "./HeroBackground";

const PageShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="cw-page">
      {/* Franja azul detrás del header */}
      <HeroBackground height={200} background="#e6f0ff" fade />
      {/* Tu app va encima de la franja, centrada */}
      <main className="cw-container">{children}</main>
    </div>
  );
};

export default PageShell;
