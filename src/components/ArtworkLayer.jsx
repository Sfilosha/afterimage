// src/components/ArtworkLayer.jsx
import React from "react";
import { NOISE_PATTERN } from "../noise";

const ArtworkLayer = ({
  imgUrl,
  dimsPx,
  position,
  rotation,
  perspective,
  shadow, // Тут тепер є shadow.contactOpacity та shadow.frameDepth
  filters,
  isDragging,
  onMouseDown,
  lightingMapUrl,
}) => {
  if (!imgUrl) return null;

  const getTransform = (offsetX = 0, offsetY = 0) => `
    translate(${position.x + offsetX}px, ${position.y + offsetY}px)
    perspective(${perspective}px)
    rotateX(${rotation.x}deg)
    rotateY(${rotation.y}deg)
    rotateZ(${rotation.z}deg)
  `;

  return (
    <>
      {/* ======================================= */}
      {/* 1. CAST SHADOW (Основна, м'яка, далека) */}
      {/* ======================================= */}
      <div
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          // Використовуємо налаштування користувача
          transform: getTransform(shadow.offsetX, shadow.offsetY),
          transformStyle: "preserve-3d",

          backgroundColor: shadow.color,
          opacity: shadow.opacity,
          filter: `blur(${shadow.blur}px)`, // Сильне розмиття

          zIndex: 28, // Найнижчий шар
          pointerEvents: "none",
        }}
      />

      {/* ======================================= */}
      {/* 2. CONTACT SHADOW (Тінь стику, чітка)   */}
      {/* ======================================= */}
      {/* Вона завжди ближче до об'єкта (наприклад, 20% від зміщення основної) */}
      <div
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          // Автоматично розраховуємо позицію: вона має бути дуже близько до картини
          transform: getTransform(shadow.offsetX * 0.2, shadow.offsetY * 0.2),
          transformStyle: "preserve-3d",

          backgroundColor: shadow.color,
          // Ця тінь зазвичай темніша
          opacity: shadow.contactOpacity,
          // І вона набагато чіткіша (менший блюр)
          filter: `blur(${Math.max(2, shadow.blur * 0.2)}px)`,

          zIndex: 29, // Між основною тінню і картиною
          pointerEvents: "none",
        }}
      />

      {/* ======================================= */}
      {/* 3. ARTWORK (Картина)                    */}
      {/* ======================================= */}
      <div
        className="draggable-artwork"
        style={{
          width: `${dimsPx.width}px`,
          height: `${dimsPx.height}px`,
          position: "absolute",
          left: 0,
          top: 0,
          transform: getTransform(0, 0),
          transformStyle: "preserve-3d",

          // Фільтри кольору
          filter: `
            brightness(${filters.brightness}%) 
            contrast(${filters.contrast}%) 
            saturate(${filters.saturate}%)
            sepia(${filters.sepia}%)
            blur(${filters.softness}px)
          `,

          cursor: isDragging ? "grabbing" : "grab",
          zIndex: 30,
          userSelect: "none",
        }}
        onMouseDown={onMouseDown}
      >
        {/* Зображення */}
        <img
          src={imgUrl}
          alt="artwork"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
          }}
        />

        {/* ------------------------------------------- */}
        {/* НОВИЙ ШАР: NOISE (ЗЕРНИСТІСТЬ)              */}
        {/* ------------------------------------------- */}
        {filters.noise > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",

              // Патерн шуму
              backgroundImage: `url(${NOISE_PATTERN})`,

              // Overlay - найкращий режим для накладання текстури
              mixBlendMode: "overlay",

              // Регулюємо силу шуму прозорістю
              opacity: filters.noise / 100,

              zIndex: 33, // Поверх картини, але під LightingMap (хоча можна і над нею)
            }}
          />
        )}

        {/* ======================================= */}
        {/* 4. INNER SHADOW (Глибина рами)          */}
        {/* ======================================= */}
        {/* Накладаємо поверх картинки div з внутрішньою тінню */}
        {shadow.frameDepth > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              // inset тінь імітує бортики рами
              boxShadow: `inset 0 0 ${shadow.frameDepth}px rgba(0,0,0,0.6)`,
              zIndex: 31,
            }}
          />
        )}

        {/* ======================================= */}
        {/* 5. LIGHTING MAP (Світло від стіни)      */}
        {/* ======================================= */}
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
              transform: "scale(1.02)",
              mixBlendMode: "multiply",
              opacity: filters.lightingMapIntensity / 100,
              zIndex: 32, // Поверх усього
            }}
          />
        )}
      </div>
    </>
  );
};

export default ArtworkLayer;
