-- 1. Create table master_jam
CREATE TABLE public.master_jam (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama_jam VARCHAR(50) NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    is_istirahat BOOLEAN DEFAULT false,
    urutan INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Delete all existing schedule data to prevent conflicts
TRUNCATE TABLE public.jadwal_pelajaran;

-- 3. Add master_jam_id to jadwal_pelajaran
ALTER TABLE public.jadwal_pelajaran
ADD COLUMN master_jam_id UUID REFERENCES public.master_jam(id) ON DELETE CASCADE;

-- 4. Insert default data for master_jam
INSERT INTO public.master_jam (nama_jam, waktu_mulai, waktu_selesai, is_istirahat, urutan) VALUES
('1', '07:00:00', '07:30:00', false, 1),
('2', '07:30:00', '08:00:00', false, 2),
('3', '08:00:00', '08:40:00', false, 3),
('4', '08:40:00', '09:20:00', false, 4),
('Istirahat', '09:20:00', '09:50:00', true, 5),
('5', '09:50:00', '10:30:00', false, 6),
('6', '10:30:00', '11:10:00', false, 7),
('7', '11:10:00', '11:50:00', false, 8),
('8', '11:50:00', '12:30:00', false, 9);
