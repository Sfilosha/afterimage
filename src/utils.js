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

// --- УТИЛІТИ ДЛЯ КОЛЬОРУ ---

// 1. Функція для отримання середнього кольору зображення
export const getAverageColor = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Малюємо зображення розміром 1x1 піксель.
      // Браузер автоматично усереднить всі кольори в цей один піксель.
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, 0, 0, 1, 1);

      // Отримуємо дані цього пікселя
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

      // Конвертуємо RGB в HEX
      const hex =
        "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      resolve(hex);
    };

    img.onerror = (e) => reject(e);
  });
};

// 2. Функція для затемнення кольору (щоб імітувати тінь на торці)
// amount - відсоток затемнення (0-100)
export const darkenColor = (hex, amount) => {
  let color = hex.substring(1);
  if (color.length === 3)
    color = color
      .split("")
      .map((c) => c + c)
      .join("");

  const num = parseInt(color, 16);
  let r = (num >> 16) - Math.round(2.55 * amount);
  let g = ((num >> 8) & 0x00ff) - Math.round(2.55 * amount);
  let b = (num & 0x0000ff) - Math.round(2.55 * amount);

  // Обмежуємо значення, щоб не вийшли за межі 0-255
  r = r < 0 ? 0 : r;
  g = g < 0 ? 0 : g;
  b = b < 0 ? 0 : b;

  return "#" + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export const project3DPoint = (x, y, z, cx, cy, rx, ry, rz, pers) => {
  // Конвертуємо кути в радіани
  const radX = (rx * Math.PI) / 180;
  const radY = (ry * Math.PI) / 180;
  const radZ = (rz * Math.PI) / 180;

  // 1. Обертання навколо X
  const y1 = y * Math.cos(radX) - z * Math.sin(radX);
  const z1 = y * Math.sin(radX) + z * Math.cos(radX);

  // 2. Обертання навколо Y (важливо: застосовуємо до результату попереднього кроку)
  const x2 = x * Math.cos(radY) + z1 * Math.sin(radY);
  const z2 = -x * Math.sin(radY) + z1 * Math.cos(radY);

  // 3. Обертання навколо Z
  const x3 = x2 * Math.cos(radZ) - y1 * Math.sin(radZ); // тут y1 чи y2?
  // У CSS порядок зазвичай: Perspective -> Rotate X -> Rotate Y -> Rotate Z.
  // Але для спрощення візьмемо повну матрицю повороту Z для фінальних координат.
  // Спростимо: послідовне застосування матриць для координат точок.

  // Правильна послідовність для імітації CSS transform order (зазвичай Z -> Y -> X або навпаки)
  // Давайте зробимо стандартну математичну ротацію:

  // Rotate X
  let px = x;
  let py = y * Math.cos(radX) - z * Math.sin(radX);
  let pz = y * Math.sin(radX) + z * Math.cos(radX);

  // Rotate Y
  let px2 = px * Math.cos(radY) + pz * Math.sin(radY);
  let py2 = py;
  let pz2 = -px * Math.sin(radY) + pz * Math.cos(radY);

  // Rotate Z
  let px3 = px2 * Math.cos(radZ) - py2 * Math.sin(radZ);
  let py3 = px2 * Math.sin(radZ) + py2 * Math.cos(radZ);
  let pz3 = pz2;

  // 4. Перспектива (Projection)
  // Чим більше perspective, тим менше викривлення.
  // Формула: screenX = x * (perspective / (perspective + z))
  // У CSS вісь Z направлена "з екрану" (позитивна), або "в екран" (негативна) залежно від реалізації.
  // Зазвичай для CSS 3D transform: d / (d - z)

  const p = pers || 1000; // Дефолтна перспектива
  const scale = p / (p - pz3); // Коефіцієнт масштабування

  return {
    x: cx + px3 * scale,
    y: cy + py3 * scale,
  };
};
