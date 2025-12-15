// src/components/Sidebar.jsx
import { useRef } from "react";
import {
  DEFAULT_SHADOW,
  DEFAULT_FILTER,
  DEFAULT_PERSPECTIVE,
} from "../defaults.js";

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

  depth,
  setDepth,
  sideColor,
  setSideColor,
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
      <div className="project-controls">
        <div className="row">
          <button onClick={handleImportClick} className="btn-primary">
            📂 Open Config
          </button>
          <button
            onClick={onExportProject}
            disabled={!hasImages}
            className="btn-primary"
          >
            💾 Save Config
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
      <div className="section">
        <h3>1. Інтер'єр</h3>
        <div className="section-content">
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
              style={{ width: "100px" }}
            />{" "}
            cm
          </div>
        </div>
      </div>

      {/* --- Секція 2: Картина --- */}
      <div className="section">
        <h3>2. Твір мистецтва</h3>
        <div className="section-content">
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
            <label className="title">Поворот Y (Стіна): {rotation.y}°</label>
            <input
              type="range"
              min="-60"
              max="60"
              value={rotation.y}
              onChange={(e) =>
                setRotation({ ...rotation, y: Number(e.target.value) })
              }
              onDoubleClick={() =>
                setRotation({ ...rotation, y: DEFAULT_PERSPECTIVE.y })
              }
            />

            <label className="title">Нахил X: {rotation.x}°</label>
            <input
              type="range"
              min="-45"
              max="45"
              value={rotation.x}
              onChange={(e) =>
                setRotation({ ...rotation, x: Number(e.target.value) })
              }
              onDoubleClick={() =>
                setRotation({ ...rotation, x: DEFAULT_PERSPECTIVE.x })
              }
            />

            <label className="title">Перспектива: {perspective}px</label>
            <input
              type="range"
              min="300"
              max="2000"
              step="50"
              value={perspective}
              onChange={(e) => setPerspective(Number(e.target.value))}
              onDoubleClick={() =>
                setPerspective(DEFAULT_PERSPECTIVE.perspective)
              }
            />
          </div>
        </div>
      </div>

      {/* <div className="section">
        <h3>4. 3D Товщина (Sides)</h3>
        <label>
          Depth X ({depth.x}):
          <input
            type="range"
            min="-10"
            max="10"
            value={depth.x}
            onChange={(e) => setDepth({ ...depth, x: Number(e.target.value) })}
          />
        </label>
        <label>
          Depth Y ({depth.y}):
          <input
            type="range"
            min="-10"
            max="10"
            value={depth.y}
            onChange={(e) => setDepth({ ...depth, y: Number(e.target.value) })}
          />
        </label>
        <label>
          Color:
          <input
            type="color"
            value={sideColor}
            onChange={(e) => setSideColor(e.target.value)}
          />
          <button
            className="btn"
            children="Remove color"
            onClick={() => setSideColor("transparent")}
          />
        </label>
      </div> */}

      {/* 3. Occlusion (AI) - ОНОВЛЕНО */}
      <div className="section">
        <h3>Depth Map (AI Auto)</h3>
        <div className="section-content">
          {!hasDepthMap ? (
            <button
              className="btn-primary"
              onClick={onGenerateDepth}
              disabled={isGeneratingDepth || !hasImages} // Треба хоча б інтер'єр
            >
              {isGeneratingDepth
                ? "🤖 Аналізую 3D..."
                : "✨ Згенерувати перекриття (AI)"}
            </button>
          ) : (
            <div className="control-group">
              <label className="title">
                Глибина картини (Z-Index): {depthThreshold}
              </label>
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
      </div>

      {/* --- Секція 3: Покращення --- */}
      <div className="section">
        <h3>3. Атмосфера та Тінь</h3>
        <div className="section-content">
          <label className="title">
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
            onDoubleClick={() =>
              setFilters({
                ...filters,
                lightingMapIntensity: DEFAULT_FILTER.lightingMapIntensity,
              })
            }
          />

          <hr></hr>

          <label className="title">Яскравість: {filters.brightness}%</label>
          <input
            type="range"
            min="50"
            max="150"
            value={filters.brightness}
            onChange={(e) =>
              setFilters({ ...filters, brightness: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setFilters({ ...filters, brightness: DEFAULT_FILTER.brightness })
            }
          />

          <label className="title">Теплота (Sepia): {filters.sepia}%</label>
          <input
            type="range"
            min="0"
            max="50"
            value={filters.sepia}
            onChange={(e) =>
              setFilters({ ...filters, sepia: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setFilters({ ...filters, sepia: DEFAULT_FILTER.sepia })
            }
          />

          <hr style={{ borderColor: "#eee", margin: "15px 0" }} />

          {/* --- SHADOW CONTROLS --- */}
          <label className="title">Тінь Blur (Розмиття): {shadow.blur}px</label>
          <input
            type="range"
            min="0"
            max="10"
            value={shadow.blur}
            onChange={(e) =>
              setShadow({ ...shadow, blur: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setShadow({ ...shadow, blur: DEFAULT_SHADOW.blur })
            }
          />

          <label className="title">Тінь Opacity: {shadow.opacity}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={shadow.opacity}
            onChange={(e) =>
              setShadow({ ...shadow, opacity: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setShadow({
                ...shadow,
                opacity: DEFAULT_SHADOW.opacity,
              })
            }
          />

          <label className="title">Зміщення X / Y</label>
          <div className="row">
            <input
              type="range"
              min="-25"
              max="25"
              value={shadow.offsetX}
              onChange={(e) =>
                setShadow({ ...shadow, offsetX: Number(e.target.value) })
              }
              onDoubleClick={() =>
                setShadow({ ...shadow, offsetX: DEFAULT_SHADOW.offsetX })
              }
            />
            <input
              type="range"
              min="-25"
              max="25"
              value={shadow.offsetY}
              onChange={(e) =>
                setShadow({ ...shadow, offsetY: Number(e.target.value) })
              }
              onDoubleClick={() =>
                setShadow({ ...shadow, offsetY: DEFAULT_SHADOW.offsetY })
              }
            />
          </div>

          <label className="title">🎨 Складні тіні:</label>

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
            onDoubleClick={() =>
              setShadow({ ...shadow, frameDepth: DEFAULT_SHADOW.frameDepth })
            }
          />

          {/* 2. Контактна тінь */}
          <label className="title">
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
            onDoubleClick={() =>
              setShadow({
                ...shadow,
                contactOpacity: DEFAULT_SHADOW.contactOpacity,
              })
            }
          />

          <div className="row">
            <label
              style={{ marginTop: "10px", display: "block", width: "100%" }}
            >
              Колір тіні:
            </label>
            <input
              type="color"
              value={shadow.color}
              onChange={(e) => setShadow({ ...shadow, color: e.target.value })}
              style={{ width: "160px", height: "44px" }}
            />
            <button
              className="btn-secondary"
              onClick={() =>
                setShadow({ ...shadow, color: DEFAULT_SHADOW.color })
              }
              title="Reset Color"
            ></button>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>5. Реальність (Imperfections)</h3>
        <div className="section-content">
          <p className="descriptor">
            Зробіть картину "менш ідеальною", щоб вона злилася з якістю фото
            інтер'єру.
          </p>

          {/* СЛАЙДЕР ШУМУ */}
          <label className="title">
            🌫 Зернистість (Noise): {filters.noise}%
          </label>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={filters.noise || 0}
            onChange={(e) =>
              setFilters({ ...filters, noise: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setFilters({ ...filters, noise: DEFAULT_FILTER.noise })
            }
          />

          {/* СЛАЙДЕР М'ЯКОСТІ */}
          <label className="title">
            💧 М'якість (Blur): {filters.softness}px
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={filters.softness || 0}
            onChange={(e) =>
              setFilters({ ...filters, softness: Number(e.target.value) })
            }
            onDoubleClick={() =>
              setFilters({ ...filters, softness: DEFAULT_FILTER.softness })
            }
          />
        </div>
      </div>

      <div className="float-section" style={{ marginTop: "auto" }}>
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
