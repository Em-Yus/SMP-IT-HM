-- Tabel Master Jam Presensi Global
CREATE TABLE IF NOT EXISTS public.master_jam_presensi (
    id SERIAL PRIMARY KEY,
    tipe_hari VARCHAR(100) NOT NULL,
    jam_masuk VARCHAR(20) NOT NULL,
    jam_pulang VARCHAR(20) NOT NULL,
    keterangan TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert data bawaan jika tabel masih kosong
INSERT INTO public.master_jam_presensi (id, tipe_hari, jam_masuk, jam_pulang, keterangan, is_active)
SELECT 1, 'Hari Reguler (Normal)', '07:00', '13:00', 'Jadwal standar presensi siswa hari efektif', true
WHERE NOT EXISTS (SELECT 1 FROM public.master_jam_presensi WHERE id = 1);

INSERT INTO public.master_jam_presensi (id, tipe_hari, jam_masuk, jam_pulang, keterangan, is_active)
SELECT 2, 'Bulan Ramadhan', '07:30', '11:30', 'Jadwal khusus selama bulan suci Ramadhan', false
WHERE NOT EXISTS (SELECT 1 FROM public.master_jam_presensi WHERE id = 2);

INSERT INTO public.master_jam_presensi (id, tipe_hari, jam_masuk, jam_pulang, keterangan, is_active)
SELECT 3, 'Hari Spesial / Event', '08:00', '11:00', 'Jadwal kegiatan atau ujian sekolah', false
WHERE NOT EXISTS (SELECT 1 FROM public.master_jam_presensi WHERE id = 3);
