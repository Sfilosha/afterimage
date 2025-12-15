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
  const [sideColor, setSideColor] = useState("transparent"); // Колір торців

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

  const getCalculatedCorners = () => {
    const { width, height } = getArtworkPxDims();
    if (!width || !height || !artworkPos || typeof width !== "number") {
      return []; // Повертаємо пустий масив, SVG просто не намалюється в цей кадр
    }

    const x = Number(artworkPos?.x) || 0;
    const y = Number(artworkPos?.y) || 0;

    // 3. Безпечне отримання повороту (Fallback на 0)
    // Важливо: rotation може бути undefined при першому рендері
    const safeRotation = Number(rotation) || 0;

    // Центр
    const cx = x + width / 2;
    const cy = y + height / 2;

    const rad = (safeRotation * Math.PI) / 180;
    const hw = width / 2;
    const hh = height / 2;

    // Координати кутів відносно ЦЕНТРУ
    const localCorners = [
      { x: -hw, y: -hh }, // TL
      { x: hw, y: -hh }, // TR
      { x: hw, y: hh }, // BR
      { x: -hw, y: hh }, // BL
    ];

    return localCorners.map((p) => ({
      x: cx + (p.x * Math.cos(rad) - p.y * Math.sin(rad)),
      y: cy + (p.x * Math.sin(rad) + p.y * Math.cos(rad)),
    }));
  };

  // Функція генерації шляхів для SVG (використовує розраховані кути)
  const getSidePaths = () => {
    const { width } = getArtworkPxDims();
    if (!width || !artworkImgUrl) return [];

    const corners = getCalculatedCorners();

    if (!corners || corners.length !== 4) return [];

    // Розраховуємо "задні" точки, додаючи вектор глибини
    const backCorners = corners.map((p) => ({
      x: p.x + depth.x,
      y: p.y + depth.y,
    }));

    // Формуємо полігони для 4 сторін: Top, Right, Bottom, Left
    return [
      // Top: TL -> TR -> BackTR -> BackTL
      `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${backCorners[1].x} ${backCorners[1].y} L ${backCorners[0].x} ${backCorners[0].y} Z`,
      // Right: TR -> BR -> BackBR -> BackTR
      `M ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${backCorners[2].x} ${backCorners[2].y} L ${backCorners[1].x} ${backCorners[1].y} Z`,
      // Bottom: BR -> BL -> BackBL -> BackBR
      `M ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} L ${backCorners[3].x} ${backCorners[3].y} L ${backCorners[2].x} ${backCorners[2].y} Z`,
      // Left: BL -> TL -> BackTL -> BackBL
      `M ${corners[3].x} ${corners[3].y} L ${corners[0].x} ${corners[0].y} L ${backCorners[0].x} ${backCorners[0].y} L ${backCorners[3].x} ${backCorners[3].y} Z`,
    ];
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
  const handleArtworkFileChange = (e) => {
    /* ... код ... */
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setArtworkImgUrl(url);
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalHeight / img.naturalWidth;
        setImgAspectRatio(ratio);
        setIsRatioLocked(true);
        const currentWidth = artworkDimsCm.width || 100;
        setArtworkDimsCm({
          width: currentWidth,
          height: Math.round(currentWidth * ratio),
        });
      };
      img.src = url;
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

  useEffect(() => {
    if (artworkImgUrl) {
      getAverageColor(artworkImgUrl)
        .then((avgColor) => {
          // Ми не просто беремо колір, а затемнюємо його на 30%,
          // тому що боковини зазвичай темніші через тінь.
          const shadowSideColor = darkenColor(avgColor, 30);
          setSideColor(shadowSideColor);
        })
        .catch((err) => {
          console.error("Не вдалося визначити колір:", err);
          setSideColor("#222222"); // Fallback на чорний
        });
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
        sideColor={sideColor}
        setSideColor={setSideColor}
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
              {artworkImgUrl && (
                <svg
                  width={displaySize.width}
                  height={displaySize.height}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 1, // Нижче, ніж ArtworkLayer (який має zIndex: 2 або auto)
                  }}
                >
                  {getSidePaths().map((pathData, index) => (
                    <path
                      key={index}
                      d={pathData}
                      fill={sideColor} // Тепер sideColor існує
                      stroke={sideColor}
                      strokeWidth={0}
                      strokeLinejoin="round"
                      opacity={0.9}
                    />
                  ))}
                </svg>
              )}

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
