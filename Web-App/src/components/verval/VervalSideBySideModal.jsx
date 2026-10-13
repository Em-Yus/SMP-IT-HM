import { useState, useEffect, useMemo } from 'react';
import { 
  X, CheckCircle2, XCircle, Copy, ArrowRight, Save, 
  Sparkles, AlertTriangle, ShieldCheck, ChevronLeft, 
  ChevronRight, RefreshCw, UserPlus, Database, FileSpreadsheet 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import { FIELD_DEFINITIONS, compareFieldValues, normalizeDate, normalizeGender } from '../../utils/vervalComparator';

export default function VervalSideBySideModal({
  isOpen,
  onClose,
  siswaValidationData,
  columnMapping = {},
  onSaveSuccess,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false
}) {
  const siswa = siswaValidationData?.siswa;
  const dapodikRow = siswaValidationData?.dapodikRow;
  const sourceType = siswaValidationData?.sourceType || 'both'; // 'both' | 'only_siakad' | 'only_dapodik'
  const displayName = siswaValidationData?.displayName || '(Tanpa Nama)';
  const displayNisn = siswaValidationData?.displayNisn || '-';
  const displayKelas = siswaValidationData?.displayKelas || '-';

  // Local state form data SIAKAD yang dapat diedit langsung
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Inisialisasi nilai Dapodik sesuai mapping untuk setiap field
  const dapodikValues = useMemo(() => {
    const vals = {};
    FIELD_DEFINITIONS.forEach(def => {
      const mappedHeader = columnMapping[def.key];
      if (mappedHeader && dapodikRow && dapodikRow[mappedHeader] !== undefined && dapodikRow[mappedHeader] !== null) {
        vals[def.key] = String(dapodikRow[mappedHeader]);
      } else {
        vals[def.key] = '';
      }
    });
    return vals;
  }, [dapodikRow, columnMapping]);

  // Inisialisasi formData saat modal terbuka atau data siswa/dapodik berubah
  useEffect(() => {
    if (!isOpen) return;

    const initial = {};

    if (sourceType === 'only_dapodik') {
      // Jika siswa baru dari Dapodik, isi awal form dengan data Dapodik yang sudah dinormalisasi
      FIELD_DEFINITIONS.forEach(def => {
        const rawDap = dapodikValues[def.key];
        if (rawDap !== undefined && rawDap !== null) {
          let val = String(rawDap).trim();
          if (def.type === 'date') {
            const nd = normalizeDate(val);
            if (nd) val = nd;
          } else if (def.type === 'gender') {
            const ng = normalizeGender(val);
            if (ng === 'L') val = 'Laki-laki';
            else if (ng === 'P') val = 'Perempuan';
          }
          initial[def.key] = val;
        } else {
          initial[def.key] = '';
        }
      });
    } else if (siswa) {
      // Jika siswa sudah ada di SIAKAD
      FIELD_DEFINITIONS.forEach(def => {
        initial[def.key] = siswa[def.key] !== null && siswa[def.key] !== undefined ? String(siswa[def.key]) : '';
      });
    }

    setFormData(initial);
  }, [siswa, dapodikRow, sourceType, isOpen, dapodikValues]);

  // Evaluasi komparasi secara real-time setiap kali input berubah
  const comparisonResults = useMemo(() => {
    const results = {};
    FIELD_DEFINITIONS.forEach(def => {
      const sVal = formData[def.key] || '';
      const dVal = dapodikValues[def.key] || '';
      const comp = compareFieldValues(def.key, sVal, dVal, def.type);
      results[def.key] = {
        isMatch: comp.isMatch,
        cleanSiakad: comp.cleanSiakad,
        cleanDapodik: comp.cleanDapodik
      };
    });
    return results;
  }, [formData, dapodikValues]);

  // Hitung jumlah field yang cocok / belum cocok
  const stats = useMemo(() => {
    let totalEssential = 0;
    let essentialMatches = 0;
    let totalMismatches = 0;

    FIELD_DEFINITIONS.forEach(def => {
      const isMatch = comparisonResults[def.key]?.isMatch;
      if (def.isEssential) {
        totalEssential += 1;
        if (isMatch) essentialMatches += 1;
      }
      if (!isMatch) {
        totalMismatches += 1;
      }
    });

    const isAllEssentialValid = totalEssential > 0 && essentialMatches === totalEssential;
    return {
      totalEssential,
      essentialMatches,
      totalMismatches,
      isAllEssentialValid
    };
  }, [comparisonResults]);

  if (!isOpen || (!siswa && !dapodikRow)) return null;

  // Handler ubah nilai input SIAKAD
  const handleInputChange = (fieldKey, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  // Salin nilai spesifik per-field dari Dapodik ke input SIAKAD
  const handleCopyFieldFromDapodik = (fieldKey, fieldType) => {
    const rawDapodikVal = dapodikValues[fieldKey];
    if (rawDapodikVal === undefined || rawDapodikVal === null) return;

    let targetVal = rawDapodikVal;

    if (fieldType === 'date') {
      const normalized = normalizeDate(rawDapodikVal);
      if (normalized) targetVal = normalized;
    } else if (fieldType === 'gender') {
      const genCode = normalizeGender(rawDapodikVal);
      if (genCode === 'L') targetVal = 'Laki-laki';
      else if (genCode === 'P') targetVal = 'Perempuan';
    }

    setFormData(prev => ({
      ...prev,
      [fieldKey]: targetVal
    }));
  };

  // Salin SEMUA nilai dari Dapodik sekaligus ke SIAKAD
  const handleCopyAllFromDapodik = () => {
    const updated = { ...formData };
    FIELD_DEFINITIONS.forEach(def => {
      const rawDapodikVal = dapodikValues[def.key];
      if (rawDapodikVal !== undefined && rawDapodikVal !== null && rawDapodikVal.trim() !== '') {
        let targetVal = rawDapodikVal.trim();
        if (def.type === 'date') {
          const normalized = normalizeDate(rawDapodikVal);
          if (normalized) targetVal = normalized;
        } else if (def.type === 'gender') {
          const genCode = normalizeGender(rawDapodikVal);
          if (genCode === 'L') targetVal = 'Laki-laki';
          else if (genCode === 'P') targetVal = 'Perempuan';
        }
        updated[def.key] = targetVal;
      }
    });
    setFormData(updated);

    Swal.fire({
      icon: 'success',
      title: 'Tersalin',
      text: 'Semua nilai acuan Dapodik berhasil disalin ke formulir SIAKAD.',
      timer: 1400,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  // Simpan / Tambahkan ke Supabase tabel `data_siswa`
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const payload = {};
      FIELD_DEFINITIONS.forEach(def => {
        const val = formData[def.key];
        payload[def.key] = val !== undefined && val !== '' ? val : null;
      });

      if (sourceType === 'only_dapodik') {
        // CASE: Siswa baru yang belum ada di SIAKAD -> INSERT
        payload.status_keaktifan = 'Aktif';
        payload.status_siswa = 'Baru';

        const { data, error } = await supabase
          .from('data_siswa')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Siswa Berhasil Didaftarkan!',
          text: `Data siswa "${data.nama}" dari Dapodik telah berhasil dimasukkan ke tabel data_siswa SIAKAD.`,
          timer: 2000,
          showConfirmButton: false
        });

        if (onSaveSuccess) {
          onSaveSuccess(data, 'insert');
        }
      } else {
        // CASE: Siswa sudah ada di SIAKAD -> UPDATE
        const { data, error } = await supabase
          .from('data_siswa')
          .update(payload)
          .eq('id', siswa.id)
          .select()
          .single();

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Perubahan Disimpan!',
          text: `Data siswa "${formData.nama || siswa.nama}" berhasil diperbarui di Supabase.`,
          timer: 1800,
          showConfirmButton: false
        });

        if (onSaveSuccess) {
          onSaveSuccess(data || { ...siswa, ...payload }, 'update');
        }
      }
    } catch (err) {
      console.error('Error simpan data_siswa:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message || 'Terjadi kesalahan saat menyimpan data ke Supabase.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              sourceType === 'only_dapodik' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-[#2a2c87]/10 text-[#2a2c87]'
            }`}>
              {sourceType === 'only_dapodik' ? <UserPlus className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  {sourceType === 'only_dapodik' ? 'Daftarkan Siswa dari Dapodik' : 'Validasi & Sinkronisasi Siswa'}
                </h2>
                
                {/* Badge Status Sumber & Validitas */}
                {sourceType === 'only_dapodik' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <UserPlus className="w-3.5 h-3.5" /> Hanya Ada di Dapodik (Data Baru)
                  </span>
                ) : sourceType === 'only_siakad' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Hanya Ada di SIAKAD (Tidak di Dapodik)
                  </span>
                ) : stats.isAllEssentialValid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Data Identik (Valid)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5" /> Belum Valid ({stats.totalEssential - stats.essentialMatches} Field Beda)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {displayName} &bull; NISN: <span className="font-mono text-slate-700">{displayNisn || '-'}</span> &bull; Kelas: {displayKelas || '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigasi Siswa Prev / Next */}
            {(hasPrev || hasNext) && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 mr-2">
                <button
                  type="button"
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] px-1 text-slate-400 font-medium">Nav</span>
                <button
                  type="button"
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Siswa Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action & Stats Banner */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {sourceType === 'only_dapodik' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 font-medium border border-blue-200">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                Siswa ini terdata di berkas Dapodik namun belum terdaftar di database SIAKAD. Periksa formulir di sebelah kanan lalu klik tombol <strong>Daftarkan ke SIAKAD</strong>.
              </span>
            ) : sourceType === 'only_siakad' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-medium border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 
                Siswa terdaftar di SIAKAD tetapi NISN/NIK/Nama tidak ditemukan di file ekspor Dapodik yang diunggah.
              </span>
            ) : stats.isAllEssentialValid ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 
                Seluruh {stats.totalEssential} kolom esensial sudah identik dengan data Dapodik.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 font-semibold border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> 
                {stats.totalEssential - stats.essentialMatches} kolom esensial berbeda dari data Dapodik.
              </span>
            )}
          </div>

          {sourceType === 'both' && (
            <button
              type="button"
              onClick={handleCopyAllFromDapodik}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-[#2a2c87] hover:bg-indigo-100 font-semibold transition border border-indigo-200 shadow-xs"
              title="Salin seluruh field acuan Dapodik ke input SIAKAD"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Salin Semua Nilai Dapodik ke SIAKAD
            </button>
          )}
        </div>

        {/* Sub-Header Kolom Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 bg-slate-100/70 text-xs font-bold text-slate-700 tracking-wide">
          <div className="p-3 border-r border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              DATA DAPODIK (ACUAN RESMI KEMDIKBUD)
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
              {sourceType === 'only_siakad' ? 'Tidak Ada' : 'Read-Only'}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between bg-indigo-50/50">
            <span className="flex items-center gap-2 text-[#2a2c87]">
              <span className="w-2 h-2 rounded-full bg-[#2a2c87]"></span>
              DATA SIAKAD LOKAL (FORMULIR INTERAKTIF)
            </span>
            <span className="text-[10px] bg-indigo-100 text-[#2a2c87] px-2 py-0.5 rounded font-semibold">
              {sourceType === 'only_dapodik' ? 'Daftar Baru' : 'Editable'}
            </span>
          </div>
        </div>

        {/* Modal Body / Split Comparison List */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(96vh-240px)] divide-y divide-slate-100">
          {FIELD_DEFINITIONS.map(field => {
            const dapodikVal = dapodikValues[field.key];
            const siakadVal = formData[field.key] ?? '';
            const comp = comparisonResults[field.key] || { isMatch: false };
            const isMatch = comp.isMatch;

            return (
              <div 
                key={field.key} 
                className={`py-3 sm:py-3.5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center rounded-lg px-2 transition ${
                  sourceType === 'both' && isMatch 
                    ? 'hover:bg-slate-50/80' 
                    : 'bg-rose-50/30 hover:bg-rose-50/60'
                }`}
              >
                {/* SISI KIRI: DAPODIK (READ-ONLY) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      {field.label}
                      {field.isEssential && (
                        <span className="text-[10px] text-rose-500 font-bold">*Wajib</span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {columnMapping[field.key] || '(Belum dipetakan)'}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <div className="w-full text-xs sm:text-sm bg-slate-100 text-slate-800 font-medium py-2 px-3 rounded-lg border border-slate-200 select-all truncate">
                      {dapodikVal ? (
                        String(dapodikVal)
                      ) : (
                        <span className="text-slate-400 italic">
                          {sourceType === 'only_siakad' ? '(Tidak ada di file Dapodik)' : '(Kosong)'}
                        </span>
                      )}
                    </div>

                    {/* Tombol Salin ke SIAKAD */}
                    {dapodikVal && !isMatch && sourceType === 'both' && (
                      <button
                        type="button"
                        onClick={() => handleCopyFieldFromDapodik(field.key, field.type)}
                        className="ml-2 p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#2a2c87] hover:border-[#2a2c87] transition shadow-2xs shrink-0 flex items-center gap-1 text-[11px]"
                        title="Salin nilai ini ke formulir SIAKAD"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Salin</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* SISI KANAN: SIAKAD (INTERAKTIF & EDITABLE) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Nilai di SIAKAD
                    </span>
                    {/* Status Centang Hijau / Silang Merah */}
                    <div className="flex items-center gap-1">
                      {sourceType === 'only_dapodik' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Data Baru
                        </span>
                      ) : sourceType === 'only_siakad' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Hanya di SIAKAD
                        </span>
                      ) : isMatch ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Cocok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Berbeda
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    {field.type === 'gender' ? (
                      <select
                        value={siakadVal}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        className={`w-full text-xs sm:text-sm rounded-lg py-2 px-3 border font-medium transition focus:outline-none focus:ring-2 ${
                          sourceType === 'both' && isMatch 
                            ? 'border-emerald-300 bg-emerald-50/20 text-slate-800 focus:ring-emerald-200' 
                            : 'border-slate-300 bg-white text-slate-900 focus:ring-indigo-200'
                        }`}
                      >
                        <option value="">-- Pilih Jenis Kelamin --</option>
                        <option value="Laki-laki">Laki-laki (L)</option>
                        <option value="Perempuan">Perempuan (P)</option>
                        <option value="L">L</option>
                        <option value="P">P</option>
                      </select>
                    ) : (
                      <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        value={siakadVal}
                        onChange={(e) => handleInputChange(field.key, e.target.value)}
                        placeholder={field.placeholder || `Masukkan ${field.label}`}
                        className={`w-full text-xs sm:text-sm rounded-lg py-2 px-3 border font-medium transition focus:outline-none focus:ring-2 ${
                          sourceType === 'both' && isMatch 
                            ? 'border-emerald-300 bg-emerald-50/20 text-slate-800 focus:ring-emerald-200' 
                            : 'border-slate-300 bg-white text-slate-900 focus:ring-indigo-200'
                        }`}
                      />
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-700">Status:</span>
            {sourceType === 'only_dapodik' ? (
              <span className="text-blue-700 font-medium">Klik simpan untuk memasukkan siswa ini ke tabel data_siswa SIAKAD.</span>
            ) : sourceType === 'only_siakad' ? (
              <span className="text-amber-700 font-medium">Siswa belum tercatat dalam database Dapodik yang diunggah.</span>
            ) : stats.totalMismatches === 0 ? (
              <span className="text-emerald-700 font-medium">Semua field telah cocok! Siap disinkronkan.</span>
            ) : (
              <span className="text-rose-700 font-medium">{stats.totalMismatches} field belum identik.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-100 transition text-sm shadow-xs disabled:opacity-50"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold transition text-sm shadow-md disabled:opacity-50 ${
                sourceType === 'only_dapodik'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'
                  : 'bg-[#2a2c87] hover:bg-[#20226b] shadow-indigo-900/20'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {sourceType === 'only_dapodik' ? 'Mendaftarkan ke SIAKAD...' : 'Menyimpan ke Supabase...'}
                </>
              ) : sourceType === 'only_dapodik' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Daftarkan Siswa ke SIAKAD
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
