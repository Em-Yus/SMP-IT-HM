const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ztfnvnbxeobxbqlydvok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Zm52bmJ4ZW9ieGJxbHlkdm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTcxMTksImV4cCI6MjA5MzEzMzExOX0.8Ppyvj9xE7dd5cd0STGjwT7A51_jfkw__cxj20hHTM4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate(jadwalId) {
  // 1. Ambil data jadwal
  const { data: jData, error: jErr } = await supabase
    .from('cbt_jadwal_ujian')
    .select(`
      *,
      data_kelas(id, nama_kelas),
      data_mapel(nama_mapel),
      data_ruang(id, nama_ruang),
      pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
      cbt_bank_soal(total_soal)
    `)
    .eq('id', jadwalId)
    .single();

  if (jErr) console.error('jErr:', jErr);
  console.log('jData:', {
    id: jData.id,
    nama_ujian: jData.nama_ujian,
    kelas_id: jData.kelas_id,
    data_kelas: jData.data_kelas,
    mode_ruang: jData.mode_ruang,
  });

  // 2. Ambil master data seluruh ruangan
  const { data: rList } = await supabase
    .from('data_ruang')
    .select('id, nama_ruang')
    .order('id');

  const { data: kelasList } = await supabase
    .from('data_kelas')
    .select('id, nama_kelas, ruang_id, data_ruang(id, nama_ruang)')
    .order('id');

  const kelasMap = {};
  (kelasList || []).forEach((k) => {
    if (k.nama_kelas) {
      kelasMap[k.nama_kelas.trim().toLowerCase()] = {
        ruang_id: k.ruang_id,
        ruang_nama: k.data_ruang?.nama_ruang || (rList || []).find((r) => r.id === k.ruang_id)?.nama_ruang || `Ruang ${k.ruang_id}`
      };
    }
  });

  // Ambil data pengaturan ruang ujian (cbt_peserta_ruang)
  let { data: pRuangData } = await supabase
    .from('cbt_peserta_ruang')
    .select(`
      id,
      jadwal_id,
      siswa_id,
      ruang_id,
      nomor_meja,
      data_ruang(id, nama_ruang)
    `)
    .eq('jadwal_id', jadwalId);

  console.log('pRuangData length:', pRuangData?.length);

  const pRuangMap = new Map();
  (pRuangData || []).forEach((p) => {
    pRuangMap.set(String(p.siswa_id), {
      ruang_id: p.ruang_id,
      nomor_meja: p.nomor_meja,
      ruang_nama: p.data_ruang?.nama_ruang || (rList || []).find((r) => r.id === p.ruang_id)?.nama_ruang || `Ruang ${p.ruang_id}`
    });
  });

  const hasPesertaRuang = pRuangData && pRuangData.length > 0;

  let q = supabase
    .from('data_siswa')
    .select('id, nama, nisn, nipd, foto_url, kelas, status_keaktifan')
    .eq('status_keaktifan', 'Aktif')
    .neq('kelas', 'Calon Siswa')
    .order('nama');

  if (!hasPesertaRuang && jData.data_kelas?.nama_kelas) {
    q = q.eq('kelas', jData.data_kelas.nama_kelas);
  }

  const { data: rawSiswa } = await q;
  console.log('rawSiswa count:', rawSiswa?.length);

  const targetSiswaList = hasPesertaRuang
    ? (rawSiswa || []).filter(s => pRuangMap.has(String(s.id)))
    : (rawSiswa || []);
  console.log('targetSiswaList count:', targetSiswaList?.length);

  const distinctRuangMap = new Map();

  const mappedSiswa = targetSiswaList.map((s) => {
    const pAlloc = pRuangMap.get(String(s.id));
    let rId = pAlloc ? pAlloc.ruang_id : 1;
    let rNama = pAlloc ? pAlloc.ruang_nama : 'Unknown';
    return { ...s, ruang_id: rId, ruang_nama: rNama };
  });

  // Filter for ruang_id = 1
  const inRuang1 = mappedSiswa.filter(s => String(s.ruang_id) === '1');
  console.log('Total in ruang 1:', inRuang1.length);
  console.log('Classes in ruang 1:', [...new Set(inRuang1.map(s => s.kelas))]);
  console.log('Students in ruang 1:', inRuang1.map(s => ({ id: s.id, nama: s.nama, kelas: s.kelas })));
}

simulate(11);
