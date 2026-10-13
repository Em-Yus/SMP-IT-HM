import React, { useState } from 'react';
import { Calculator, Compass, BarChart2, Hash, Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import CbtMathRenderer from './CbtMathRenderer';

export const MATH_SMP_TEMPLATES = {
  aljabar: {
    name: 'Aritmetika & Aljabar',
    icon: Calculator,
    items: [
      { label: 'Pecahan', latex: '\\frac{a}{b}', preview: '\\frac{a}{b}', desc: 'Pecahan biasa' },
      { label: 'Pecahan Campuran', latex: '1\\frac{a}{b}', preview: '1\\frac{a}{b}', desc: 'Pecahan campuran' },
      { label: 'Kuadrat', latex: 'x^2', preview: 'x^2', desc: 'Pangkat 2' },
      { label: 'Pangkat n', latex: 'x^{n}', preview: 'x^n', desc: 'Pangkat bilangan' },
      { label: 'Akar Kuadrat', latex: '\\sqrt{x}', preview: '\\sqrt{x}', desc: 'Akar pangkat 2' },
      { label: 'Akar Pangkat n', latex: '\\sqrt[n]{x}', preview: '\\sqrt[3]{x}', desc: 'Bentuk akar pangkat n' },
      { label: 'Perkalian', latex: '\\times', preview: '\\times', desc: 'Simbol kali' },
      { label: 'Pembagian', latex: '\\div', preview: '\\div', desc: 'Simbol bagi' },
      { label: 'Plus-Minus', latex: '\\pm', preview: '\\pm', desc: 'Lebih kurang / plus-minus' },
      { label: 'Persen', latex: '\\%', preview: '\\%', desc: 'Persentase' },
      { label: 'Tidak Sama', latex: '\\neq', preview: '\\neq', desc: 'Tidak sama dengan' },
      { label: 'Kira-kira', latex: '\\approx', preview: '\\approx', desc: 'Mendekati / kira-kira' },
      { label: 'Nilai Mutlak', latex: '|x|', preview: '|x|', desc: 'Nilai mutlak' },
      { label: 'Kuadratik', latex: 'ax^2 + bx + c = 0', preview: 'ax^2+bx+c=0', desc: 'Bentuk umum persamaan kuadrat' },
    ],
  },
  geometri: {
    name: 'Geometri & Pengukuran',
    icon: Compass,
    items: [
      { label: 'Derajat', latex: '^{\\circ}', preview: '30^\\circ', desc: 'Derajat sudut/suhu' },
      { label: 'Pi (π)', latex: '\\pi', preview: '\\pi', desc: 'Konstanta lingkaran' },
      { label: 'Sudut', latex: '\\angle ABC', preview: '\\angle ABC', desc: 'Notasi sudut' },
      { label: 'Segitiga', latex: '\\triangle ABC', preview: '\\triangle ABC', desc: 'Notasi bangun segitiga' },
      { label: 'Tegak Lurus', latex: '\\perp', preview: '\\perp', desc: 'Garis tegak lurus' },
      { label: 'Sejajar', latex: '\\parallel', preview: '\\parallel', desc: 'Dua garis sejajar' },
      { label: 'Sebangun', latex: '\\sim', preview: '\\sim', desc: 'Kesebangunan' },
      { label: 'Kongruen', latex: '\\cong', preview: '\\cong', desc: 'Kekongruenan' },
      { label: 'Panjang Busur', latex: '\\overparen{AB}', preview: '\\overparen{AB}', desc: 'Busur lingkaran' },
      { label: 'Luas (cm²)', latex: '\\text{cm}^2', preview: '\\text{cm}^2', desc: 'Satuan luas' },
      { label: 'Volume (cm³)', latex: '\\text{cm}^3', preview: '\\text{cm}^3', desc: 'Satuan volume' },
      { label: 'Alpha (α)', latex: '\\alpha', preview: '\\alpha', desc: 'Sudut alpha' },
      { label: 'Beta (β)', latex: '\\beta', preview: '\\beta', desc: 'Sudut beta' },
      { label: 'Theta (θ)', latex: '\\theta', preview: '\\theta', desc: 'Sudut theta' },
    ],
  },
  himpunan: {
    name: 'Himpunan & Statistik',
    icon: BarChart2,
    items: [
      { label: 'Irisan (∩)', latex: '\\cap', preview: 'A \\cap B', desc: 'Irisan dua himpunan' },
      { label: 'Gabungan (∪)', latex: '\\cup', preview: 'A \\cup B', desc: 'Gabungan dua himpunan' },
      { label: 'Elemen (∈)', latex: '\\in', preview: 'x \\in A', desc: 'Anggota himpunan' },
      { label: 'Bukan Elemen (∉)', latex: '\\notin', preview: 'x \\notin A', desc: 'Bukan anggota' },
      { label: 'Bagian (⊂)', latex: '\\subset', preview: 'A \\subset B', desc: 'Himpunan bagian' },
      { label: 'Himpunan Kosong', latex: '\\emptyset', preview: '\\emptyset', desc: 'Himpunan tanpa anggota' },
      { label: 'Rata-rata (x̄)', latex: '\\bar{x}', preview: '\\bar{x}', desc: 'Mean / rata-rata data' },
      { label: 'Kurang Dari/Sama', latex: '\\le', preview: '\\le', desc: 'Kurang dari atau sama dengan' },
      { label: 'Lebih Dari/Sama', latex: '\\ge', preview: '\\ge', desc: 'Lebih dari atau sama dengan' },
      { label: 'Jumlah (∑)', latex: '\\sum', preview: '\\sum', desc: 'Notasi sigma penjumlahan' },
      { label: 'Tak Hingga (∞)', latex: '\\infty', preview: '\\infty', desc: 'Simbol infinity' },
    ],
  },
};

export default function CbtMathToolbar({ onInsert, activeTarget = 'pertanyaan', onChangeTarget }) {
  const [activeTab, setActiveTab] = useState('aljabar');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const handleItemClick = (latex) => {
    // Sisipkan dengan format $...$ jika belum ada delimiter
    const codeToInsert = `$${latex}$`;
    if (onInsert) {
      onInsert(codeToInsert, activeTarget);
    }
  };

  const handleWrapMath = () => {
    if (onInsert) {
      onInsert('$$', activeTarget);
    }
  };

  return (
    <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-3.5 mb-3 shadow-xs transition-all">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Calculator size={15} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              Bilah Alat Matematika SMP (KaTeX & LaTeX)
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-semibold">
                Khusus Guru MTK
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Target input selector */}
          {onChangeTarget && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-white px-2 py-1 rounded-lg border border-gray-200">
              <span>Target:</span>
              <select
                value={activeTarget}
                onChange={(e) => onChangeTarget(e.target.value)}
                className="bg-transparent font-bold text-indigo-600 outline-none cursor-pointer"
              >
                <option value="pertanyaan">Batang Soal (Pertanyaan)</option>
                <option value="opsi_a">Pilihan Opsi A</option>
                <option value="opsi_b">Pilihan Opsi B</option>
                <option value="opsi_c">Pilihan Opsi C</option>
                <option value="opsi_d">Pilihan Opsi D</option>
                <option value="kunci_jawaban">Kunci Jawaban Singkat</option>
                <option value="rubrik_esai">Rubrik Penilaian Esai</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-2 py-1 rounded-lg border border-indigo-200 transition"
            title="Lihat panduan penulisan rumus matematika"
          >
            <HelpCircle size={13} />
            <span className="hidden sm:inline">Panduan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title={isExpanded ? 'Sembunyikan toolbar' : 'Tampilkan toolbar'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Guide Panel */}
      {showGuide && (
        <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-2 text-gray-700 animate-in fade-in duration-150">
          <p className="font-bold text-indigo-900 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600" />
            Cara Menulis Rumus Matematika di Soal:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-600">
            <li>
              Cukup klik tombol rumus di bawah atau gunakan tanda dolar <code className="bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-700 font-mono">$...$</code> untuk rumus sejajar teks.
            </li>
            <li>
              Gunakan tanda dolar ganda <code className="bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-700 font-mono">$$...$$</code> untuk rumus yang berada di baris tersendiri di tengah (Display Mode).
            </li>
            <li>
              <strong>Contoh Pecahan:</strong> <code className="font-mono bg-white px-1 rounded">$\frac&#123;3&#125;&#123;4&#125;$</code> menghasilkan <CbtMathRenderer text="$\frac{3}{4}$" inline />
            </li>
            <li>
              <strong>Contoh Akar & Pangkat:</strong> <code className="font-mono bg-white px-1 rounded">$\sqrt&#123;x^2 + y^2&#125;$</code> menghasilkan <CbtMathRenderer text="$\sqrt{x^2 + y^2}$" inline />
            </li>
            <li>
              <strong>Contoh Geometri & Derajat:</strong> <code className="font-mono bg-white px-1 rounded">$\angle B = 90^\circ$</code> menghasilkan <CbtMathRenderer text="$\angle B = 90^\circ$" inline />
            </li>
          </ul>
        </div>
      )}

      {/* Categories Tab and Button Grid */}
      {isExpanded && (
        <div className="mt-2.5 space-y-2.5">
          {/* Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Object.entries(MATH_SMP_TEMPLATES).map(([key, cat]) => {
              const Icon = cat.icon;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Buttons Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 max-h-44 overflow-y-auto p-1 bg-white rounded-xl border border-gray-200">
            {MATH_SMP_TEMPLATES[activeTab]?.items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleItemClick(item.latex)}
                className="group flex flex-col items-center justify-center p-2 rounded-lg border border-gray-100 bg-gray-50/60 hover:bg-indigo-50 hover:border-indigo-300 transition text-center min-h-[52px]"
                title={`${item.desc} (Klik untuk menyisipkan ke ${activeTarget})`}
              >
                <div className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition">
                  <CbtMathRenderer text={`$${item.preview}$`} inline />
                </div>
                <span className="text-[10px] text-gray-400 group-hover:text-indigo-600 font-medium truncate w-full mt-0.5">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span>
              Menyisipkan rumus langsung ke: <strong className="text-indigo-600 capitalize">{activeTarget.replace('_', ' ')}</strong>
            </span>
            <button
              type="button"
              onClick={handleWrapMath}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              + Tambah Blok Formula $$...$$
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
