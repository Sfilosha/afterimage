// src/utils.js

export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Можна додати сюди математику для розрахунку діагоналей, якщо знадобиться пізніше
export const calculateDiagonal = (w, h) => Math.sqrt(w * w + h * h);

export const blobUrlToBase64 = async (blobUrl) => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateLightingMap = async (
  interiorImgObj,
  cropX,
  cropY,
  cropW,
  cropH
) => {
  if (!interiorImgObj) return null;

  // 1. Створюємо канвас розміром з картину
  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");

  // 2. Вирізаємо шматок інтер'єру (Crop)
  // drawImage(source, sX, sY, sW, sH, dX, dY, dW, dH)
  ctx.drawImage(
    interiorImgObj,
    cropX,
    cropY,
    cropW,
    cropH, // Звідки брати (координати на оригіналі)
    0,
    0,
    cropW,
    cropH // Куди малювати (на весь канвас)
  );

  // 3. Обробка: Grayscale + High Contrast
  // Можна зробити це піксельно, але швидше через filter
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, cropW, cropH); // Знебарвлюємо

  ctx.globalCompositeOperation = "source-over"; // Повертаємо режим

  // 4. Повертаємо як Base64
  return canvas.toDataURL();
};
