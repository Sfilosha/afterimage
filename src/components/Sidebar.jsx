// src/components/Sidebar.jsx
import { useRef } from "react";
import React from "react";

const Sidebar = ({
  // Handlers for Files
  onInteriorChange,
  onArtworkChange,

  // Dimensions
  artworkDims,
  onWidthChange,
  onHeightChange,
  isRatioLocked,
  toggleRatioLock,

  // Tools
  drawMode,
  toggleDrawMode,
  refLengthCm,
  setRefLengthCm,

  // 3D Transforms
  rotation,
  setRotation,
  perspective,
  setPerspective,

  // Filters
  filters,
  setFilters,

  // Shadow
  shadow,
  setShadow,

  // Actions
  onSave,
  isSaving,
  hasImages,

  isGeneratingDepth,
  onGenerateDepth,
  depthThreshold,
  setDepthThreshold,
  hasDepthMap, // чи згенерована вже карта

  onExportProject,
  onImportProject,
}) => {
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImportProject(file);
    }
    // Скидаємо value, щоб можна було відкрити той самий файл двічі, якщо треба
    e.target.value = null;
  };

  return (
    <div className="sidebar">
      <div
        className="project-controls"
        style={{
          borderBottom: "1px solid #ddd",
          paddingBottom: "15px",
          marginBottom: "15px",
        }}
      >
        <h3>📁 Проект</h3>
        <div className="row">
          <button
            onClick={onExportProject}
            disabled={!hasImages}
            style={{ flex: 1, marginRight: "5px" }}
          >
            💾 Зберегти конфіг
          </button>
          <button
            onClick={handleImportClick}
            style={{ flex: 1, marginLeft: "5px", backgroundColor: "#6c757d" }}
          >
            📂 Відкрити
          </button>
          {/* Прихований інпут для ZIP */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".zip"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* --- Секція 1: Файли та Масштаб --- */}
      <h3>1. Інтер'єр</h3>
      <div className="section">
        <input type="file" onChange={onInteriorChange} accept="image/*" />
        <div className="row">
          <button
            className={`mode-btn ${drawMode === "refLine" ? "active" : ""}`}
            onClick={toggleDrawMode}
          >
            {drawMode === "refLine" ? "Стоп" : "Лінійка"}
          </button>
          <input
            type="number"
            value={refLengthCm}
            onChange={(e) => setRefLengthCm(Number(e.target.value))}
            style={{ width: "50px" }}
          />{" "}
          cm
        </div>
      </div>

      {/* --- Секція 2: Картина --- */}
      <h3>2. Геометрія</h3>
      <div className="section">
        <input type="file" onChange={onArtworkChange} accept="image/*" />
        <div className="row">
          <label className="sm-label">
            W (cm){" "}
            <input
              type="number"
              value={artworkDims.width}
              onChange={onWidthChange}
            />
          </label>
          <label className="sm-label">
            H (cm){" "}
            <input
              type="number"
              value={artworkDims.height}
              onChange={onHeightChange}
            />
          </label>
          <button onClick={toggleRatioLock}>
            {isRatioLocked ? "🔒" : "🔓"}
          </button>
        </div>

        <div className="control-group">
          <label>Поворот Y (Стіна): {rotation.y}°</label>
          <input
            type="range"
            min="-60"
            max="60"
            value={rotation.y}
            onChange={(e) =>
              setRotation({ ...rotation, y: Number(e.target.value) })
            }
          />

          <label>Нахил X: {rotation.x}°</label>
          <input
            type="range"
            min="-45"
            max="45"
            value={rotation.x}
            onChange={(e) =>
              setRotation({ ...rotation, x: Number(e.target.value) })
            }
          />

          <label>Перспектива: {perspective}px</label>
          <input
            type="range"
            min="300"
            max="2000"
            step="50"
            value={perspective}
            onChange={(e) => setPerspective(Number(e.target.value))}
          />
        </div>
      </div>

      {/* 3. Occlusion (AI) - ОНОВЛЕНО */}
      <h3>3. Перекриття (AI Auto)</h3>
      <div className="section">
        {!hasDepthMap ? (
          <button
            className="btn-primary"
            style={{ background: "#6f42c1" }} // Фіолетовий колір для AI
            onClick={onGenerateDepth}
            disabled={isGeneratingDepth || !hasImages} // Треба хоча б інтер'єр
          >
            {isGeneratingDepth
              ? "🤖 Аналізую 3D..."
              : "✨ Авто-перекриття (AI)"}
          </button>
        ) : (
          <div className="control-group">
            <label>Глибина картини (Z-Index): {depthThreshold}</label>
            <input
              type="range"
              min="1"
              max="255"
              step="1"
              value={depthThreshold}
              onChange={(e) => setDepthThreshold(Number(e.target.value))}
            />
            <p style={{ fontSize: "11px", color: "#666" }}>
              Тягніть вліво/вправо, щоб помістити картину ЗА об'єкти (вазони,
              лампи).
            </p>
          </div>
        )}
      </div>

      {/* --- Секція 3: Покращення --- */}
      <h3>3. Атмосфера та Тінь</h3>
      <div className="section">
        <label>
          💡 Вплив оточення (Lighting Map): {filters.lightingMapIntensity}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.lightingMapIntensity || 0}
          onChange={(e) =>
            setFilters({
              ...filters,
              lightingMapIntensity: Number(e.target.value),
            })
          }
        />

        <hr></hr>

        <label>Яскравість: {filters.brightness}%</label>
        <input
          type="range"
          min="50"
          max="150"
          value={filters.brightness}
          onChange={(e) =>
            setFilters({ ...filters, brightness: Number(e.target.value) })
          }
        />

        <label>Теплота (Sepia): {filters.sepia}%</label>
        <input
          type="range"
          min="0"
          max="50"
          value={filters.sepia}
          onChange={(e) =>
            setFilters({ ...filters, sepia: Number(e.target.value) })
          }
        />

        <hr style={{ borderColor: "#eee", margin: "15px 0" }} />

        {/* --- SHADOW CONTROLS --- */}
        <label>Тінь Blur (Розмиття): {shadow.blur}px</label>
        <input
          type="range"
          min="0"
          max="100"
          value={shadow.blur}
          onChange={(e) =>
            setShadow({ ...shadow, blur: Number(e.target.value) })
          }
        />

        <label>Тінь Opacity: {shadow.opacity}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={shadow.opacity}
          onChange={(e) =>
            setShadow({ ...shadow, opacity: Number(e.target.value) })
          }
        />

        <label>Зміщення X / Y</label>
        <div className="row">
          <input
            type="range"
            min="-50"
            max="50"
            value={shadow.offsetX}
            onChange={(e) =>
              setShadow({ ...shadow, offsetX: Number(e.target.value) })
            }
          />
          <input
            type="range"
            min="-50"
            max="50"
            value={shadow.offsetY}
            onChange={(e) =>
              setShadow({ ...shadow, offsetY: Number(e.target.value) })
            }
          />
        </div>

        <label>🎨 Складні тіні:</label>

        {/* 1. Глибина рами */}
        <label style={{ fontSize: "12px" }}>
          🖼 Глибина рами (Inner): {shadow.frameDepth}px
        </label>
        <input
          type="range"
          min="0"
          max="50"
          value={shadow.frameDepth || 0}
          onChange={(e) =>
            setShadow({ ...shadow, frameDepth: Number(e.target.value) })
          }
        />

        {/* 2. Контактна тінь */}
        <label style={{ fontSize: "12px" }}>
          🌑 Контактна тінь (Contact): {shadow.contactOpacity}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={shadow.contactOpacity || 0}
          onChange={(e) =>
            setShadow({ ...shadow, contactOpacity: Number(e.target.value) })
          }
        />

        <label style={{ marginTop: "10px", display: "block" }}>
          Колір тіні:
        </label>
        <input
          type="color"
          value={shadow.color}
          onChange={(e) => setShadow({ ...shadow, color: e.target.value })}
          style={{ width: "100%", height: "30px" }}
        />
      </div>

      <div className="section" style={{ marginTop: "auto" }}>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={isSaving || !hasImages}
        >
          {isSaving ? "Рендерінг..." : "Зберегти HD"}
        </button>
      </div>
      <h3>5. Реальність (Imperfections)</h3>
      <div className="section">
        <p style={{ fontSize: "11px", color: "#666", marginBottom: "10px" }}>
          Зробіть картину "менш ідеальною", щоб вона злилася з якістю фото
          інтер'єру.
        </p>

        {/* СЛАЙДЕР ШУМУ */}
        <label>🌫 Зернистість (Noise): {filters.noise}%</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={filters.noise || 0}
          onChange={(e) =>
            setFilters({ ...filters, noise: Number(e.target.value) })
          }
        />

        {/* СЛАЙДЕР М'ЯКОСТІ */}
        <label>💧 М'якість (Blur): {filters.softness}px</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={filters.softness || 0}
          onChange={(e) =>
            setFilters({ ...filters, softness: Number(e.target.value) })
          }
        />
      </div>

      <div className="section" style={{ marginTop: "auto" }}>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={isSaving || !hasImages}
        >
          {isSaving ? "Рендерінг..." : "Зберегти HD Зображення"}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
