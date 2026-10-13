import React, { useState, useRef, useEffect } from 'react';
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, X, Move, Sparkles } from 'lucide-react';

export default function CbtImageCropModal({ isOpen, imageFile, onCropComplete, onCancel }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState('4:3'); // 'free', '1:1', '4:3', '16:9'

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          setZoom(1);
          setRotation(0);
          setPan({ x: 0, y: 0 });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageFile);
    } else {
      setImageSrc(null);
    }
  }, [imageFile]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Tentukan ukuran output berdasarkan aspect ratio
    let outWidth = 800;
    let outHeight = 600;

    if (aspectRatio === '1:1') {
      outWidth = 600;
      outHeight = 600;
    } else if (aspectRatio === '16:9') {
      outWidth = 960;
      outHeight = 540;
    } else if (aspectRatio === '4:3') {
      outWidth = 800;
      outHeight = 600;
    } else {
      outWidth = img.width;
      outHeight = img.height;
    }

    canvas.width = outWidth;
    canvas.height = outHeight;

    // Bersihkan canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outWidth, outHeight);

    ctx.save();
    ctx.translate(outWidth / 2, outHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Hitung posisi dengan pan offset yang dinormalisasi
    const scaleFactor = Math.min(outWidth / img.width, outHeight / img.height);
    const drawWidth = img.width * scaleFactor;
    const drawHeight = img.height * scaleFactor;

    ctx.drawImage(
      img,
      -drawWidth / 2 + pan.x * (outWidth / 360),
      -drawHeight / 2 + pan.y * (outHeight / 270),
      drawWidth,
      drawHeight
    );
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], imageFile.name.replace(/\.[^/.]+$/, "") + '_crop.webp', {
            type: 'image/webp',
          });
          onCropComplete(croppedFile);
        }
      },
      'image/webp',
      0.9
    );
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Crop size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm">Sesuaikan & Crop Gambar Soal Matematika</h3>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-white/20 rounded-lg text-gray-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preset Rasio */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-700">Rasio Gambar:</span>
            <div className="flex gap-1">
              {[
                { key: '4:3', label: '4:3 (Grafik/Geometri)' },
                { key: '16:9', label: '16:9 (Lebar)' },
                { key: '1:1', label: '1:1 (Venn/Persegi)' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setAspectRatio(r.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    aspectRatio === r.key
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Crop Viewport */}
          <div
            className="relative w-full h-72 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none border-2 border-dashed border-gray-300"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Guide Grid overlay */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-25">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            <img
              src={imageSrc}
              alt="Crop Source"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            />

            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
              <Move size={10} /> Geser untuk posisi diagram
            </div>
          </div>

          {/* Controls: Zoom & Rotate */}
          <div className="flex items-center justify-between gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 flex-1">
              <ZoomOut size={16} className="text-gray-500" />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <ZoomIn size={16} className="text-gray-500" />
              <span className="text-xs font-mono font-bold text-gray-700 min-w-[3rem] text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-2xs"
            >
              <RotateCw size={14} />
              <span>Putar 90°</span>
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>Terapkan & Unggah Gambar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
