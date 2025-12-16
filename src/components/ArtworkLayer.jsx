// src/components/ArtworkLayer.jsx
import { NOISE_PATTERN } from "../noise";

const sideHeight = 2;

const ArtworkLayer = ({
  imgUrl,
  dimsPx,
  position,
  rotation,
  perspective,
  shadow,
  filters,
  isDragging,
  onMouseDown,
  lightingMapUrl,
  sides,
}) => {
  if (!imgUrl) return null;

  const FRAME_THICKNESS = sides.thickness;

  // Основна трансформація застосовується до КОНТЕЙНЕРА 3D об'єкта
  const getTransform = (offsetX = 0, offsetY = 0) => `
    translate(${position.x + offsetX}px, ${position.y + offsetY}px)
    perspective(${perspective}px)
    rotateX(${rotation.x}deg)
    rotateY(${rotation.y}deg)
    rotateZ(${rotation.z}deg)
  `;

  // Стиль для спільних властивостей бічних граней
  const sideFaceStyle = {
    position: "absolute",
    backgroundColor: sides.color,
    outline: `1px solid ${sides.color}`,
    // Можна додати легку тінь всередину, щоб стики були реалістичнішими
    boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)",
    backfaceVisibility: "hidden", // Ховаємо грані, якщо дивимось зсередини
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <>
      {/* ======================================= */}
      {/* ТІНІ (Залишаються поза 3D об'єктом)    */}
      {/* ======================================= */}
      {/* Вони проектуються на "стіну", тому не є частиною коробки, що обертається */}

      {/* 1. CAST SHADOW */}
      <div
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          transform: getTransform(shadow.offsetX, shadow.offsetY),
          // Важливо: тінь має бути трохи позаду самого об'єкта по Z
          transformOrigin: "50% 50% 0",
          transformStyle: "preserve-3d",
          backgroundColor: shadow.color,
          opacity: shadow.opacity,
          filter: `blur(${shadow.blur}px)`,
          zIndex: 28,
          pointerEvents: "none",
        }}
      />

      {/* 2. CONTACT SHADOW */}
      <div
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          transform: getTransform(shadow.offsetX * 0.2, shadow.offsetY * 0.2),
          transformOrigin: "50% 50% 0",
          transformStyle: "preserve-3d",
          backgroundColor: shadow.color,
          opacity: shadow.contactOpacity,
          filter: `blur(${Math.max(2, shadow.blur * 0.2)}px)`,
          zIndex: 29,
          pointerEvents: "none",
        }}
      />

      {/* ================================================================== */}
      {/* 3D ARTWORK CONTAINER (Головна обгортка, що обертається)            */}
      {/* ================================================================== */}
      <div
        className="artwork-3d-wrapper"
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          // Застосовуємо основну трансформацію сюди
          transform: getTransform(0, 0),
          // КРИТИЧНО ВАЖЛИВО: дозволяє вкладеним елементам бути в 3D
          transformStyle: "preserve-3d",
          // Центр обертання має бути в центрі об'єкта
          transformOrigin: "50% 50%",

          cursor: isDragging ? "grabbing" : "grab",
          zIndex: 30,
          userSelect: "none",
        }}
        onMouseDown={onMouseDown}
      >
        {/* ======================================= */}
        {/* ПЕРЕДНЯ ГРАНЬ (Власне картина)          */}
        {/* ======================================= */}
        {/* Це ваш старий div.draggable-artwork, але тепер він всередині */}

        {/* ======================================= */}
        {/* БІЧНІ ГРАНІ (Створюють об'єм)           */}
        {/* ======================================= */}

        {/* ПРАВА ГРАНЬ */}
        <div
          style={{
            ...sideFaceStyle,
            width: `${FRAME_THICKNESS}px`,
            height: `${dimsPx.height - sideHeight}px`,
            left: `${dimsPx.width / 2 - FRAME_THICKNESS / 2}px`, // Центруємо по горизонталі
            top: 1,
            // Повертаємо на 90 град по Y і висуваємо вправо на половину ширини картини
            transform: `rotateY(90deg) translateZ(${dimsPx.width / 2}px)`,
          }}
        />

        {/* ЛІВА ГРАНЬ */}
        <div
          style={{
            ...sideFaceStyle,
            width: `${FRAME_THICKNESS}px`,
            height: `${dimsPx.height - sideHeight}px`,
            left: `${dimsPx.width / 2 - FRAME_THICKNESS / 2}px`, // Центруємо по горизонталі
            top: 1,
            // Повертаємо на -90 град по Y і висуваємо (тепер це вліво від центру)
            transform: `rotateY(-90deg) translateZ(${dimsPx.width / 2}px)`,
          }}
        />

        {/* ВЕРХНЯ ГРАНЬ */}
        <div
          style={{
            ...sideFaceStyle,
            width: `${dimsPx.width - sideHeight}px`,
            height: `${FRAME_THICKNESS}px`,
            top: `${dimsPx.height / 2 - FRAME_THICKNESS / 2}px`, // Центруємо по вертикалі
            left: 0,
            // Повертаємо на 90 град по X і висуваємо вгору
            transform: `rotateX(90deg) translateZ(${dimsPx.height / 2}px)`,
          }}
        />

        {/* НИЖНЯ ГРАНЬ */}
        <div
          style={{
            ...sideFaceStyle,
            width: `${dimsPx.width - sideHeight}px`,
            height: `${FRAME_THICKNESS}px`,
            top: `${dimsPx.height / 2 - FRAME_THICKNESS / 2}px`, // Центруємо по вертикалі
            left: 0,
            // Повертаємо на -90 град по X і висуваємо вниз
            transform: `rotateX(-90deg) translateZ(${dimsPx.height / 2}px)`,
          }}
        />

        <div
          className="artwork-front-face"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            left: 0,
            top: 0,
            // Висуваємо вперед на половину товщини
            transform: `translateZ(${FRAME_THICKNESS / 2}px)`,
            // Важливо: приховуємо "спину" картини, щоб не мерехтіла при сильних поворотах
            backfaceVisibility: "hidden",
            overflow: "hidden",
            backgroundColor: "#fff", // Базовий колір, якщо картинка з прозорістю
            zIndex: 2,

            filter: `
            brightness(${filters.brightness}%) 
            contrast(${filters.contrast}%) 
            saturate(${filters.saturate}%)
            sepia(${filters.sepia}%)
            blur(${filters.softness}px)
          `,
          }}
        >
          {/* ... Вміст картини (img, noise, inner shadow, lighting map) ... */}
          <img
            src={imgUrl}
            alt="artwork"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              pointerEvents: "none",
              imageRendering: "high-quality",
            }}
          />
          {filters.noise > 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                backgroundImage: `url(${NOISE_PATTERN})`,
                mixBlendMode: "overlay",
                opacity: filters.noise / 100,
                zIndex: 33,
              }}
            />
          )}
          {shadow.frameDepth > 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                boxShadow: `inset 0 0 ${shadow.frameDepth}px rgba(0,0,0,0.6)`,
                zIndex: 31,
              }}
            />
          )}
          {lightingMapUrl && filters.lightingMapIntensity > 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                backgroundColor: "white",
                backgroundImage: `url(${lightingMapUrl})`,
                backgroundSize: "cover",
                filter: `blur(${filters.lightingMapBlur}px) contrast(1.5) brightness(1.2) grayscale(100%)`,
                transform: "scale(1.1)", // Невеликий скейл, щоб перекрити краї
                mixBlendMode: "multiply",
                opacity: filters.lightingMapIntensity / 100,
                zIndex: 32,
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default ArtworkLayer;
