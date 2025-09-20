import React from "react";

/**
 * Franja de color detrás del header.
 * No bloquea clics; solo es decorativa (pointer-events: none).
 */
type Props = {
  /** Alto en píxeles de la franja visible (default 200) */
  height?: number;
  /** Color o gradient CSS (default #e6f0ff) */
  background?: string;
  /** Si quieres que se “desvanezca” al contenido (default true) */
  fade?: boolean;
};

const HeroBackground: React.FC<Props> = ({
  height = 200,
  background = "#e6f0ff",
  fade = true,
}) => {
  const style: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height,
    background: fade
      ? `linear-gradient(180deg, ${background} 0%, rgba(230,240,255,0.65) 60%, rgba(230,240,255,0) 100%)`
      : background,
    pointerEvents: "none",
    zIndex: 0,
  };

  return <div aria-hidden="true" style={style} />;
};

export default HeroBackground;
