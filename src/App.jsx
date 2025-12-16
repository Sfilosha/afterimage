import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Line } from "react-konva";
import * as htmlToImage from "html-to-image";
import Sidebar from "./components/Sidebar";
import ArtworkLayer from "./components/ArtworkLayer";
import { generateDepthMap, applyThresholdToDepthMap } from "./depthService";
import { generateLightingMap, getAverageColor, darkenColor } from "./utils"; //
import JSZip from "jszip";
import {
  DEFAULT_FILTER,
  DEFAULT_SHADOW,
  DEFAULT_PERSPECTIVE,
  DEFAULT_SIDES,
} from "./defaults.js";
import { saveAs } from "file-saver";
import "./App.css";

function App() {
  const [interiorImgUrl, setInteriorImgUrl] = useState(null);
  const [interiorImageObj, setInteriorImageObj] = useState(null);
  const [lightingMapUrl, setLightingMapUrl] = useState(null);
  const [displaySize, setDisplaySize] = useState({
    width: 0,
    height: 0,
    scale: 1,
  });

  const [artworkImgUrl, setArtworkImgUrl] = useState(null);
  const [artworkDimsCm, setArtworkDimsCm] = useState({
    width: 100,
    height: 100,
  });
  const [artworkPos, setArtworkPos] = useState({ x: 50, y: 50 });

  const [isRatioLocked, setIsRatioLocked] = useState(true);
  const [imgAspectRatio, setImgAspectRatio] = useState(null);

  const [rotation, setRotation] = useState({ ...DEFAULT_PERSPECTIVE });
  const [perspective, setPerspective] = useState(
    DEFAULT_PERSPECTIVE.perspective
  );
  const [filters, setFilters] = useState({ ...DEFAULT_FILTER });

  // До речі, тепер blur у тіні працюватиме краще
  const [shadow, setShadow] = useState({ ...DEFAULT_SHADOW });
  const [drawMode, setDrawMode] = useState("none");
  const [refLineCoords, setRefLineCoords] = useState([]);
  const [isDrawingRef, setIsDrawingRef] = useState(false);
  const [refLengthCm, setRefLengthCm] = useState(250);
  const [pixelsPerCm, setPixelsPerCm] = useState(null);

  const [isDraggingArtwork, setIsDraggingArtwork] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [depth, setDepth] = useState({ x: 0, y: 0 }); // Вектор глибини (куди "дивиться" товщина)
  const [sides, setSides] = useState({ ...DEFAULT_SIDES });

  const [isGeneratingDepth, setIsGeneratingDepth] = useState(false);
  const [rawDepthCanvas, setRawDepthCanvas] = useState(null); // Тут зберігаємо оригінал карти глибини (canvas елемент)
  const [depthThreshold, setDepthThreshold] = useState(150); // Значення слайдера (0-255)
  const [finalMaskUrl, setFinalMaskUrl] = useState(null); // Готова URL маски для CSS

  const containerRef = useRef(null);
  const captureAreaRef = useRef(null);

  const getArtworkPxDims = () => {
    let widthPx = displaySize.width * 0.2;
    let heightPx = widthPx * (artworkDimsCm.height / artworkDimsCm.width);
    if (pixelsPerCm) {
      widthPx = artworkDimsCm.width * pixelsPerCm;
      heightPx = artworkDimsCm.height * pixelsPerCm;
    }
    return { width: widthPx, height: heightPx };
  };

  const resizeImage = (file, maxWidth = 1080) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Логіка зменшення зі збереженням пропорцій
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round(height * (maxWidth / width));
              width = maxWidth;
            } else {
              width = Math.round(width * (maxWidth / height));
              height = maxWidth;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          // Вмикаємо якісне згладжування при ресайзі
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, 0, 0, width, height);

          // Повертаємо стиснуте зображення (JPEG, якість 0.9)
          // Якщо треба прозорість (PNG), можна змінити тип, але для картин краще JPEG
          resolve(
            canvas.toDataURL(
              file.type === "image/png" ? "image/png" : "image/jpeg",
              0.9
            )
          );
        };
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    });
  };

  const updateLightingMap = async () => {
    // Перевірка на наявність даних
    if (!interiorImageObj || !displaySize.scale) return;

    const scale = displaySize.scale;

    // ВИПРАВЛЕННЯ:
    // Ми більше не використовуємо getPosInPx().
    // artworkPos вже містить правильні пікселі відносно лівого верхнього кута контейнера.
    const currentPxX = artworkPos.x;
    const currentPxY = artworkPos.y;

    // Конвертуємо екранні пікселі в пікселі оригінального зображення
    const originalX = currentPxX / scale;
    const originalY = currentPxY / scale;

    const pxDims = getArtworkPxDims(); // Розміри картини на екрані
    const originalW = pxDims.width / scale;
    const originalH = pxDims.height / scale;

    const mapUrl = await generateLightingMap(
      interiorImageObj,
      originalX,
      originalY,
      originalW,
      originalH
    );
    setLightingMapUrl(mapUrl);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updateLightingMap();
    }, 500); // 0.5с після зміни розміру
    return () => clearTimeout(timer);
  }, [artworkDimsCm, interiorImageObj]); // Коли міняється розмір або фонова картинка

  const handleExportProject = async () => {
    if (!interiorImgUrl || !artworkImgUrl) {
      alert("Немає зображень для збереження.");
      return;
    }

    try {
      const zip = new JSZip();

      // 1. Отримуємо бінарні дані (Blob) з наших поточних URL
      const interiorBlob = await fetch(interiorImgUrl).then((r) => r.blob());
      const artworkBlob = await fetch(artworkImgUrl).then((r) => r.blob());

      // 2. Додаємо картинки в архів
      // Можна дати їм фіксовані імена або генерувати унікальні
      const interiorFilename = "interior.png";
      const artworkFilename = "artwork.png";

      zip.file(interiorFilename, interiorBlob);
      zip.file(artworkFilename, artworkBlob);

      // 3. Формуємо JSON (тепер без Base64!)
      const projectData = {
        version: 2.0, // Версія структури
        timestamp: new Date().toISOString(),
        files: {
          interior: interiorFilename,
          artwork: artworkFilename,
        },
        // Геометрія та налаштування
        config: {
          refLengthCm,
          refLineCoords, // Якщо масив порожній - ОК
          artwork: {
            dimsCm: artworkDimsCm,
            position: artworkPos,
            isRatioLocked,
            imgAspectRatio,
          },
          geometry: {
            rotation,
            perspective,
          },
          style: {
            shadow,
            filters,
            sides,
          },
          ai: {
            depthThreshold,
          },
        },
      };

      // 4. Додаємо JSON в архів
      zip.file("project-data.json", JSON.stringify(projectData, null, 2));

      // 5. Генеруємо ZIP і віддаємо користувачу
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `scene-${Date.now()}.zip`);
    } catch (error) {
      console.error("Export ZIP failed:", error);
      alert("Помилка при створенні архіву.");
    }
  };

  // --- ЛОГІКА ІМПОРТУ ---
  const handleImportProject = async (file) => {
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);

      // 1. Шукаємо файл конфігурації
      if (!zip.file("project-data.json")) {
        alert("Невірний архів: відсутній project-data.json");
        return;
      }

      const jsonStr = await zip.file("project-data.json").async("string");
      const data = JSON.parse(jsonStr);

      // 2. Відновлюємо Інтер'єр
      const interiorFile = zip.file(data.files.interior);
      if (interiorFile) {
        const blob = await interiorFile.async("blob");
        const url = URL.createObjectURL(blob);
        setInteriorImgUrl(url);
        const img = new window.Image();
        img.src = url;
        img.onload = () => setInteriorImageObj(img);
      }

      // 3. Відновлюємо Картину
      const artworkFile = zip.file(data.files.artwork);
      if (artworkFile) {
        const blob = await artworkFile.async("blob");
        const url = URL.createObjectURL(blob);
        setArtworkImgUrl(url);
        // Встановлюємо параметри тільки після завантаження картинки, але стейти можна й одразу
      }

      // 4. Відновлюємо Конфігурацію
      const cfg = data.config;

      setRefLengthCm(cfg.refLengthCm);
      setRefLineCoords(cfg.refLineCoords || []);
      setArtworkDimsCm(cfg.artwork.dimsCm);
      setArtworkPos(cfg.artwork.position);
      setIsRatioLocked(cfg.artwork.isRatioLocked);
      setImgAspectRatio(cfg.artwork.imgAspectRatio);

      if (cfg.geometry) {
        setRotation(cfg.geometry.rotation);
        setPerspective(cfg.geometry.perspective);
      }
      if (cfg.style) {
        setShadow((prev) => ({
          ...prev,
          ...cfg.style.shadow,
        }));

        setFilters((prev) => ({
          ...prev,
          ...cfg.style.filters,
        }));

        setSides((prev) => ({
          ...prev,
          ...cfg.style.sides,
        }));
      }
      if (cfg.ai) {
        setDepthThreshold(cfg.ai.depthThreshold);
        // Скидаємо маску, бо це новий проект
        setRawDepthCanvas(null);
        setFinalMaskUrl(null);
      }
    } catch (error) {
      console.error("Import ZIP failed:", error);
      alert("Помилка читання архіву.");
    }
  };

  useEffect(() => {
    if (rawDepthCanvas) {
      const url = applyThresholdToDepthMap(rawDepthCanvas, depthThreshold);
      setFinalMaskUrl(url);
    }
  }, [depthThreshold, rawDepthCanvas]);

  // Запуск AI
  const handleGenerateDepth = async () => {
    if (!interiorImgUrl) return;
    setIsGeneratingDepth(true);
    try {
      // 1. Генеруємо карту
      const canvas = await generateDepthMap(interiorImgUrl);
      setRawDepthCanvas(canvas);

      // 2. Створюємо першу версію маски
      const url = applyThresholdToDepthMap(canvas, depthThreshold);
      setFinalMaskUrl(url);
    } catch (error) {
      console.error("AI Error:", error);
      alert(
        "Помилка генерації глибини. Перевірте консоль (може блокуватись AdBlock або повільний інтернет)."
      );
    } finally {
      setIsGeneratingDepth(false);
    }
  };

  // ... (Всі Handlers: handleInteriorFileChange, handleArtworkFileChange і т.д. БЕЗ ЗМІН) ...
  const handleInteriorFileChange = (e) => {
    /* ... код ... */
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setInteriorImgUrl(url);
      const img = new window.Image();
      img.src = url;
      img.onload = () => setInteriorImageObj(img);
      setRefLineCoords([]);
      setPixelsPerCm(null);
      setRawDepthCanvas(null);
      setFinalMaskUrl(null);
    }
  };
  const handleArtworkFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // 1. Спочатку зменшуємо зображення (макс 1600px)
      // Це поверне рядок base64, який готовий до використання
      const optimizedUrl = await resizeImage(file);

      // 2. Зберігаємо це зменшене зображення в стейт для відображення
      setArtworkImgUrl(optimizedUrl);

      // 3. Вираховуємо пропорції, використовуючи вже оптимізовану картинку
      const img = new window.Image();

      img.onload = () => {
        // Рахуємо Ratio (воно таке саме, як в оригіналу)
        const ratio = img.naturalHeight / img.naturalWidth;

        setImgAspectRatio(ratio);
        setIsRatioLocked(true);

        // Оновлюємо розміри в сантиметрах
        // Якщо ширина вже задана - підтягуємо висоту. Якщо ні - ставимо дефолт 100см.
        const currentWidth = artworkDimsCm.width || 100;
        setArtworkDimsCm({
          width: currentWidth,
          height: Math.round(currentWidth * ratio),
        });
      };

      // Важливо: ми завантажуємо в img саме optimizedUrl
      img.src = optimizedUrl;

      // 4. (Бонус з минулого кроку) Одразу рахуємо колір торців
      getAverageColor(optimizedUrl)
        .then((color) => setSides(getAverageColor(color)))
        .catch(() => setSides({ ...sides, color: DEFAULT_SIDES.color }));
    } catch (error) {
      console.error("Помилка при обробці файлу:", error);
    }
  };
  const handleWidthChange = (e) => {
    const newW = Number(e.target.value);
    let newH = artworkDimsCm.height;
    if (isRatioLocked && imgAspectRatio)
      newH = Math.round(newW * imgAspectRatio);
    setArtworkDimsCm({ width: newW, height: newH });
  };
  const handleHeightChange = (e) => {
    const newH = Number(e.target.value);
    let newW = artworkDimsCm.width;
    if (isRatioLocked && imgAspectRatio)
      newW = Math.round(newH / imgAspectRatio);
    setArtworkDimsCm({ width: newW, height: newH });
  };

  useEffect(() => {
    const calculateSize = () => {
      if (!interiorImageObj || !containerRef.current) return;
      const MAX_SIZE = 800; // Жорстке обмеження

      // Рахуємо масштаб, щоб вписати картинку в 800x800
      const scale = Math.min(
        MAX_SIZE / interiorImageObj.width,
        MAX_SIZE / interiorImageObj.height
      );

      setDisplaySize({
        width: interiorImageObj.width * scale,
        height: interiorImageObj.height * scale,
        scale: scale,
      });
    };
    if (interiorImageObj) calculateSize();
  }, [interiorImageObj]);

  useEffect(() => {
    /* ... код лінійки ... */
    if (refLineCoords.length === 4 && refLengthCm > 0) {
      const dx = refLineCoords[2] - refLineCoords[0];
      const dy = refLineCoords[3] - refLineCoords[1];
      const pxLen = Math.sqrt(dx * dx + dy * dy);
      setPixelsPerCm(pxLen / refLengthCm);
    }
  }, [refLineCoords, refLengthCm]);

  const setAvgSideColor = () => {
    getAverageColor(artworkImgUrl)
      .then((avgColor) => {
        // Ми не просто беремо колір, а затемнюємо його на 30%,
        // тому що боковини зазвичай темніші через тінь.
        const shadowSideColor = darkenColor(avgColor, 30);
        setSides({
          ...sides,
          color: shadowSideColor,
          default_color: shadowSideColor,
        });
      })
      .catch((err) => {
        console.error("Не вдалося визначити колір:", err);
      });
  };

  useEffect(() => {
    if (artworkImgUrl) {
      setAvgSideColor();
    }
  }, [artworkImgUrl]); // Запускаємо, коли міняється картинка

  const handleArtworkMouseDown = (e) => {
    if (drawMode === "refLine") return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingArtwork(true);
    setDragOffset({
      x: e.clientX - artworkPos.x,
      y: e.clientY - artworkPos.y,
    });
  };
  const handleContainerMouseMove = (e) => {
    /* ... */
    if (drawMode === "refLine" && isDrawingRef) return;
    if (isDraggingArtwork) {
      setArtworkPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };
  const handleContainerMouseUp = () => {
    setIsDraggingArtwork(false);
    setIsDrawingRef(false);
    if (drawMode === "refLine") setDrawMode("none");
    if (isDraggingArtwork) {
      updateLightingMap();
    }
  };
  const handleStageMouseDown = (e) => {
    /* ... */ if (drawMode !== "refLine") return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setIsDrawingRef(true);
    setRefLineCoords([pos.x, pos.y, pos.x, pos.y]);
  };
  const handleStageMouseMove = (e) => {
    /* ... */ if (drawMode !== "refLine" || !isDrawingRef) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setRefLineCoords([refLineCoords[0], refLineCoords[1], pos.x, pos.y]);
  };

  // --- НОВА ФУНКЦІЯ ЗБЕРЕЖЕННЯ ---
  const handleSave = async () => {
    if (!captureAreaRef.current) return;
    setIsSaving(true);

    try {
      const dataUrl = await htmlToImage.toPng(captureAreaRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",

        // Don't include red ruler
        filter: (node) => {
          if (node.classList && node.classList.contains("ruler-layer")) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `render-image.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Не вдалося зберегти зображення. Спробуйте ще раз.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-container">
      {/* ... Sidebar ... */}
      <Sidebar
        onInteriorChange={handleInteriorFileChange}
        onArtworkChange={handleArtworkFileChange}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        artworkDims={artworkDimsCm}
        onWidthChange={handleWidthChange}
        onHeightChange={handleHeightChange}
        isRatioLocked={isRatioLocked}
        toggleRatioLock={() => setIsRatioLocked(!isRatioLocked)}
        drawMode={drawMode}
        toggleDrawMode={() =>
          setDrawMode(drawMode === "refLine" ? "none" : "refLine")
        }
        refLengthCm={refLengthCm}
        setRefLengthCm={setRefLengthCm}
        rotation={rotation}
        setRotation={setRotation}
        perspective={perspective}
        setPerspective={setPerspective}
        filters={filters}
        setFilters={setFilters}
        shadow={shadow}
        setShadow={setShadow}
        onSave={handleSave}
        isSaving={isSaving}
        hasImages={!!interiorImageObj && !!artworkImgUrl}
        isGeneratingDepth={isGeneratingDepth}
        onGenerateDepth={handleGenerateDepth}
        depthThreshold={depthThreshold}
        setDepthThreshold={setDepthThreshold}
        hasDepthMap={!!rawDepthCanvas}
        depth={depth}
        setDepth={setDepth}
        sides={sides}
        setSides={setSides}
      />

      <div
        className="main-area"
        ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
      >
        {interiorImageObj && displaySize.width > 0 ? (
          <div
            ref={captureAreaRef}
            className="canvas-container"
            style={{
              width: displaySize.width,
              height: displaySize.height,
              position: "relative",
              overflow: "hidden",
              backgroundColor: "#fff",
            }}
          >
            <img
              src={interiorImgUrl}
              alt="interior"
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
              }}
            />

            {/* КОНТЕЙНЕР ДЛЯ МАСКИ */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none", // Щоб можна було клікати крізь нього
                zIndex: 30,
                // ОСЬ ТУТ МАГІЯ: застосовуємо маску до контейнера з картиною
                // Якщо маски немає, maskImage = 'none' (все видно)
                maskImage: finalMaskUrl ? `url(${finalMaskUrl})` : "none",
                WebkitMaskImage: finalMaskUrl ? `url(${finalMaskUrl})` : "none",
                maskSize: "cover",
                WebkitMaskSize: "cover",
              }}
            >
              {/* ШАР КАРТИНИ (ARTWORK) */}
              {/* Додаємо zIndex: 2, щоб картина гарантовано була ПОВЕРХ граней */}
              <div
                style={{
                  pointerEvents: "auto",
                  width: "100%",
                  height: "100%",
                }}
              >
                <ArtworkLayer
                  imgUrl={artworkImgUrl}
                  dimsPx={getArtworkPxDims()}
                  position={artworkPos}
                  rotation={rotation}
                  perspective={perspective}
                  shadow={shadow}
                  filters={filters}
                  isDragging={isDraggingArtwork}
                  onMouseDown={handleArtworkMouseDown}
                  lightingMapUrl={lightingMapUrl}
                  sides={sides}
                />
              </div>
            </div>

            <Stage
              className="ruler-layer"
              width={displaySize.width}
              height={displaySize.height}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 99,
                pointerEvents: drawMode === "refLine" ? "auto" : "none",
              }}
            >
              <Layer>
                {refLineCoords.length === 4 && (
                  <Line points={refLineCoords} stroke="red" strokeWidth={2} />
                )}
              </Layer>
            </Stage>
          </div>
        ) : (
          <div className="empty-state">Завантажте інтер'єр</div>
        )}
      </div>
    </div>
  );
}

export default App;
