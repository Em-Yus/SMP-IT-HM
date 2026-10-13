import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Wand2, Sparkles, FileSpreadsheet } from 'lucide-react';
import { FIELD_DEFINITIONS, autoMatchColumns } from '../../utils/vervalComparator';

export default function VervalMappingModal({
  isOpen,
  onClose,
  detectedHeaders = [],
  sampleRows = [],
  currentMapping = {},
  onConfirmMapping
}) {
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (Object.keys(currentMapping).length > 0) {
        setMapping({ ...currentMapping });
      } else {
        const auto = autoMatchColumns(detectedHeaders, FIELD_DEFINITIONS);
        setMapping(auto);
      }
    }
  }, [isOpen, currentMapping, detectedHeaders]);

  if (!isOpen) return null;

  const handleSelectChange = (key, value) => {
    setMapping(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetAutoMatch = () => {
    const auto = autoMatchColumns(detectedHeaders, FIELD_DEFINITIONS);
    setMapping(auto);
  };

  const handleClearAll = () => {
    const empty = {};
    FIELD_DEFINITIONS.forEach(def => {
      empty[def.key] = '';
    });
    setMapping(empty);
  };

  // Hitung jumlah kolom esensial yang terpetakan
  const essentialFields = FIELD_DEFINITIONS.filter(f => f.isEssential);
  const mappedEssentialCount = essentialFields.filter(f => mapping[f.key]).length;
  const isAllEssentialMapped = mappedEssentialCount === essentialFields.length;

  const handleConfirm = () => {
    onConfirmMapping(mapping);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2a2c87]/10 flex items-center justify-center text-[#2a2c87]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Pemetaan Kolom Database Dapodik
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-[#2a2c87] font-semibold">
                  Auto-Matched
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Cocokkan kolom tabel data siswa SIAKAD dengan header kolom yang terdeteksi dari file Dapodik
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Status Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Status Kolom Wajib:</span>
            {isAllEssentialMapped ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> {mappedEssentialCount} dari {essentialFields.length} Kolom Esensial Terpetakan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" /> {mappedEssentialCount} dari {essentialFields.length} Kolom Esensial Terpetakan
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">
              Total Header Terdeteksi: <strong className="text-slate-700">{detectedHeaders.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAutoMatch}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition font-medium shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#2a2c87]" />
              Cocokkan Ulang Otomatis
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition font-medium"
            >
              Kosongkan Semua
            </button>
          </div>
        </div>

        {/* Modal Body / Side-by-Side Mapping Table */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-190px)] space-y-6">
          
          {/* Section 1: Kolom Esensial (Utama) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Kolom Esensial (Wajib untuk Penentuan Status Valid)
              </h3>
              <span className="text-xs text-slate-400">8 Atribut Kunci</span>
            </div>
            
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
              {essentialFields.map((field) => {
                const selectedHeader = mapping[field.key] || '';
                const sampleVal = selectedHeader && sampleRows.length > 0 ? sampleRows[0][selectedHeader] : null;

                return (
                  <div 
                    key={field.key} 
                    className={`grid grid-cols-1 md:grid-cols-12 items-center p-3 gap-3 transition ${
                      selectedHeader ? 'bg-white' : 'bg-rose-50/40'
                    }`}
                  >
                    {/* Sisi Kiri: Field SIAKAD */}
                    <div className="md:col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#2a2c87] flex items-center justify-center font-bold text-xs shrink-0">
                        {field.key.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{field.label}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            Wajib
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">data_siswa.{field.key}</span>
                      </div>
                    </div>

                    {/* Penghubung Arrow */}
                    <div className="hidden md:flex md:col-span-1 justify-center text-slate-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Sisi Kanan: Dropdown Header Dapodik */}
                    <div className="md:col-span-6 space-y-1">
                      <div className="relative">
                        <select
                          value={selectedHeader}
                          onChange={(e) => handleSelectChange(field.key, e.target.value)}
                          className={`w-full text-xs sm:text-sm rounded-lg py-2 pl-3 pr-8 border font-medium transition focus:outline-none focus:ring-2 ${
                            selectedHeader 
                              ? 'border-emerald-300 bg-emerald-50/20 text-slate-800 focus:ring-emerald-200' 
                              : 'border-rose-300 bg-rose-50/30 text-rose-800 focus:ring-rose-200'
                          }`}
                        >
                          <option value="">-- Pilih Header dari File Dapodik --</option>
                          {detectedHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sample Preview Data */}
                      {selectedHeader && sampleVal !== undefined && sampleVal !== null && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pl-1 truncate">
                          <span className="text-slate-400 font-medium">Contoh data:</span>
                          <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-xs">
                            {String(sampleVal) || '(Kosong)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Kolom Tambahan / Pendukung (Opsional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Kolom Tambahan / Pelengkap (Opsional)
              </h3>
              <span className="text-xs text-slate-400">Informasi Alamat & Orang Tua</span>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
              {FIELD_DEFINITIONS.filter(f => !f.isEssential).map((field) => {
                const selectedHeader = mapping[field.key] || '';
                const sampleVal = selectedHeader && sampleRows.length > 0 ? sampleRows[0][selectedHeader] : null;

                return (
                  <div 
                    key={field.key} 
                    className="grid grid-cols-1 md:grid-cols-12 items-center p-3 gap-3 bg-white"
                  >
                    {/* Sisi Kiri */}
                    <div className="md:col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {field.key.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                          <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            Opsional
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">data_siswa.{field.key}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex md:col-span-1 justify-center text-slate-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Sisi Kanan */}
                    <div className="md:col-span-6 space-y-1">
                      <select
                        value={selectedHeader}
                        onChange={(e) => handleSelectChange(field.key, e.target.value)}
                        className="w-full text-xs sm:text-sm rounded-lg py-2 pl-3 pr-8 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                      >
                        <option value="">(Jangan Petakan / Abaikan)</option>
                        {detectedHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>

                      {selectedHeader && sampleVal !== undefined && sampleVal !== null && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pl-1 truncate">
                          <span className="text-slate-400 font-medium">Contoh data:</span>
                          <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-xs">
                            {String(sampleVal) || '(Kosong)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 hidden sm:block">
            Pastikan seluruh kolom esensial telah dipetakan untuk hasil verifikasi yang akurat.
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-100 transition text-sm shadow-xs"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2a2c87] text-white font-semibold hover:bg-[#20226b] transition text-sm shadow-md shadow-indigo-900/20"
            >
              <Sparkles className="w-4 h-4" />
              Simpan & Proses Komparasi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
