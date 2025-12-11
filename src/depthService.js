// src/depthService.js
import { pipeline, env } from "@xenova/transformers";

// Налаштування: не завантажувати локальні моделі, брати з CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

let depthPipeline = null;

export const loadDepthModel = async () => {
  if (!depthPipeline) {
    console.log("Завантаження моделі Depth Anything...");
    // Використовуємо 'depth-anything-small-hf' - вона швидка і точна
    depthPipeline = await pipeline(
      "depth-estimation",
      "Xenova/depth-anything-small-hf"
    );
  }
  return depthPipeline;
};

export const generateDepthMap = async (imageSrc) => {
  const pipe = await loadDepthModel();

  // 1. Запуск інференсу (передбачення)
  const output = await pipe(imageSrc);

  // output.depth - це RawImage об'єкт
  // Нам треба перетворити його на Canvas, щоб читати пікселі
  return output.depth.toCanvas();
};

// Функція, яка створює чорно-білу маску на основі порогу (threshold)
export const applyThresholdToDepthMap = (depthCanvas, threshold = 128) => {
  const width = depthCanvas.width;
  const height = depthCanvas.height;

  const ctx = depthCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data; // [r, g, b, a, r, g, b, a, ...]

  // Створюємо нову картинку для маски
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  const maskImageData = maskCtx.createImageData(width, height);
  const maskData = maskImageData.data;

  // Логіка:
  // У карті глибини: Біле (255) = Близько, Чорне (0) = Далеко.
  // Threshold (наприклад, 100) - це глибина, де висить наша картина.
  // Все, що яскравіше (ближче) за 100 - має перекривати картину (бути чорним у масці, якщо ми юзаємо mask-image).
  // CSS mask-image працює так: прозорі пікселі маски приховують елемент. Чорні/непрозорі - показують.

  for (let i = 0; i < data.length; i += 4) {
    const depthValue = data[i]; // Беремо червоний канал (він такий же як G і B у ч/б)

    // Якщо об'єкт БЛИЖЧЕ (яскравіше), ніж поріг картини -> Маска прозора (ховаємо картину)
    if (depthValue > threshold) {
      maskData[i] = 0; // R
      maskData[i + 1] = 0; // G
      maskData[i + 2] = 0; // B
      maskData[i + 3] = 0; // Alpha (Прозоро = приховати картину)
    } else {
      // Якщо об'єкт ДАЛІ (темніше), ніж картина -> Маска заповнена (показуємо картину)
      maskData[i] = 0; // R
      maskData[i + 1] = 0; // G
      maskData[i + 2] = 0; // B
      maskData[i + 3] = 255; // Alpha (Непрозоро = показати картину)
    }
  }

  maskCtx.putImageData(maskImageData, 0, 0);
  return maskCanvas.toDataURL();
};
