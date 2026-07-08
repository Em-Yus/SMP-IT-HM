import { Wrench, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UnderConstruction() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-blue-50 p-6 rounded-full mb-6">
        <Wrench size={64} className="text-primary animate-pulse" />
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-3">
        Sedang Dalam Pengembangan
      </h1>
      <p className="text-gray-500 max-w-md mx-auto mb-8">
        Halaman yang Anda tuju saat ini masih dalam tahap pengerjaan (Under Construction). Fitur ini akan segera hadir pada pembaruan sistem berikutnya.
      </p>
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-900 transition shadow-lg shadow-blue-900/20"
      >
        <ArrowLeft size={18} />
        Kembali ke Halaman Sebelumnya
      </button>
    </div>
  );
}
