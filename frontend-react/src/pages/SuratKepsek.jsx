import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { FileText, Plus, RefreshCw, Printer } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SuratKepsek() {
  const [dataSurat, setDataSurat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_surat')
        .select('*')
        .eq('jenis_surat', 'kepsek')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setDataSurat(data || []);
    } catch (err) {
      console.error(err);
      setDataSurat([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileText className="text-primary" /> Surat Keputusan & Kepala Sekolah
          </h2>
          <p className="text-gray-500 text-sm mt-1">Arsip dan pembuatan surat resmi dari Kepala Sekolah.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Buat Surat Baru
          </button>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nomor Surat</th>
                <th className="px-6 py-4">Perihal</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Tujuan</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : dataSurat.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Belum ada arsip surat keputusan.
                  </td>
                </tr>
              ) : (
                dataSurat.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.nomor_surat}</td>
                    <td className="px-6 py-4 font-bold text-primary">{item.perihal}</td>
                    <td className="px-6 py-4 text-gray-600">{item.tanggal}</td>
                    <td className="px-6 py-4 text-gray-600">{item.tujuan || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-500 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded font-medium flex items-center justify-center gap-1 mx-auto">
                        <Printer size={14} /> Cetak
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
