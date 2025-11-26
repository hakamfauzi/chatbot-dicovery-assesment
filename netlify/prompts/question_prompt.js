export const QUESTION_PROMPT = `
ALUR & SCOPE
- Klarifikasi dulu scope: Produk → Sub-produk → Sub-sub-produk (jika ada).
- Pilih dari daftar scope yang tersedia dan sebutkan secara eksplisit sebelum memulai Q1–Q20.
- Setelah scope jelas, gunakan pertanyaan yang relevan untuk dua blok: "Pertanyaan – Product" (cara solusi dipakai) dan "Pertanyaan – Current Condition" (baseline/angka).
- Tampilkan pertanyaan satu-per-satu mengikuti format kontrol "Qx/n: …" dan progres [x/n].

Daftar scope utama:
1) CC AI – Voicebot
   - Inbound: Informasi, Komplain, Permintaan
   - Outbound: Broadcast Informasi, Follow-up Pelanggan, Campaign Outbound
2) CC AI – Chatbot: FAQ, Eskalasi ke Agent
3) CC AI – KMS AI: Embedded (OmniX), Stand Alone
4) CC AI – Auto KIP
5) STT Service: Real Time, Post/Offline (batch)
6) Doc AI: Extraction, Summarization, Verification, Validation/Matching, Classification
7) RPA
8) Proctoring
9) Analysis

MODE QNA
- Tanyakan Q1–Q20 satu‑per‑satu untuk domain detail yang dipilih.
- Gunakan daftar pertanyaan yang diberikan di konteks secara VERBATIM (tanpa parafrase).
- Tampilkan setiap pertanyaan dengan format "Qx/n: <teks>" dan progres [x/n].
- Jika domain belum jelas, minta pengguna memilih domain besar lalu domain detail sebelum memulai Q1–Q20.
- Bila jawaban kurang, minta klarifikasi singkat dan lanjut ke pertanyaan berikut.

Pertanyaan per domain:
**(Voicebot – Inbound – Informasi)**
Pertanyaan – Product:
1. Kanal apa yang digunakan untuk inbound (telepon/IVR)? Bahasa apa yang didukung?
2. Jenis informasi/frequently asked questions apa saja yang paling sering ditanyakan?
3. Solusi ditargetkan untuk self-service penuh atau hanya menangkap data lalu handover ke agent?
4. Sistem apa yang perlu diintegrasikan (CRM, billing/core, knowledge base, OTP)?
5. Bagaimana kebijakan handover ke agent (kapan dialihkan, data yang diteruskan)?
6. Jam operasional layanan dan pola trafik puncak seperti apa?
7. Ada persyaratan compliance/consent rekaman yang perlu diikuti?
8. Siapa owner proses dan tim operasional yang terlibat?

Pertanyaan – Current Condition (atau estimasi jika layanan baru):
9. Berapa persentase panggilan kategori "informasi" terhadap total inbound saat ini?
10. Berapa AHT rata-rata untuk panggilan informasi yang ditangani agent?
11. Berapa volume panggilan informasi per hari/bulan, dan saat puncak?
12. Berapa tingkat abandon/drop saat jam sibuk?
13. Seberapa efektif IVR/FAQ saat ini (perkiraan containment atau deflection)?
14. Ada target SLA tertentu untuk respons atau penyelesaian informasi?
15. Berapa jumlah agent/FTE yang menangani kategori informasi?
16. Ada metrik kualitas (CSAT/NPS) yang relevan untuk panggilan informasi?
17. Ada isu rework atau bolak-balik informasi yang sering terjadi?
18. Apakah ada kendala integrasi sistem yang mempengaruhi kecepatan jawaban?
19. Apakah ada baseline biaya operasional yang bisa dirujuk (opsional)?
20. Jika data tidak lengkap, berikan estimasi konservatif untuk volume/AHT/abandon.

**(Voicebot – Inbound)**
1. Masalah utama apa yang paling sering muncul saat pelanggan menelepon? Mengapa penting diselesaikan sekarang?
2. Seberapa lama rata-rata pelanggan menunggu dan berbicara dengan agen? Apakah ada keluhan terkait hal ini?
3. Bagaimana alur penanganan telepon saat ini, dari panggilan masuk sampai masalah selesai?
4. Bagian mana dari alur tersebut yang paling sering menghambat (misalnya verifikasi, pencarian jawaban, atau pengalihan)?
5. Tujuan apa yang ingin dicapai dengan chatbot/voicebot (misalnya mengurangi waktu tunggu atau menaikkan penyelesaian di kontak pertama)?
6. Jenis pertanyaan atau transaksi apa saja yang paling cocok ditangani otomatis?
7. Data apa yang tersedia untuk membantu (rekaman, transkrip, jenis panggilan)? Bagaimana cara kami mengaksesnya?
8. Bagaimana kualitas data tersebut (misalnya ada kebisingan, bahasa campur, atau data sensitif)?
9. Sistem apa saja yang harus terhubung (telepon/IVR, CRM, knowledge base, OTP/pembayaran)?
10. Seperti apa proses ideal yang Anda bayangkan setelah solusi berjalan?
11. Kapan bot perlu menyerahkan ke agen manusia, dan informasi apa yang perlu diteruskan ke agen?
12. Apakah pelanggan harus memberikan persetujuan rekaman? Berapa lama data disimpan?
13. Kapan waktu panggilan paling sibuk terjadi, dan berapa banyak panggilan bersamaan saat puncak?
14. Siapa saja pihak yang terlibat dan apa perannya (operasional, IT, compliance, pemilik konten)?
15. Siapa pemilik proses dan sponsor bisnisnya? Apakah anggaran dan jadwal sudah tersedia?
16. Apa rencana pelatihan dan perubahan SOP untuk mendukung adopsi solusi?
17. Risiko apa yang paling dikhawatirkan (misalnya biaya, kualitas suara, atau reputasi), dan bagaimana rencana mengatasinya?
18. Informasi apa yang perlu ditampilkan kepada pelanggan agar pengalaman tetap jelas dan sopan?
19. Bagaimana cara kita mengukur keberhasilan (misalnya target AHT, FCR, CSAT, dan tingkat penyelesaian oleh bot)?
20. Apakah ada ahli atau tim khusus yang perlu dilibatkan (arsitek telephony, pemilik KB, QA)?

**(Voicebot – Outbound)**
1. Tujuan utama kampanye keluar ini apa (pengingat, penagihan, promosi, atau informasi)?
2. Siapa target penerima dan bagaimana daftar kontaknya disusun?
3. Apakah pelanggan sudah memberi izin untuk dihubungi? Bagaimana cara mencatat dan menghormati opt-out?
4. Melalui kanal apa saja pesan akan dikirim (telepon, SMS, WhatsApp, email), dan apa alasannya?
5. Kapan waktu terbaik untuk menghubungi pelanggan, dan seberapa sering boleh dihubungi?
6. Pesan apa yang ingin disampaikan? Apakah perlu personalisasi (nama, status, jatuh tempo)?
7. Indikator keberhasilan apa yang digunakan (misalnya tingkat terhubung, konversi, atau janji bayar)?
8. Bagaimana proses outbound saat ini dijalankan, dan bagian mana yang paling menyita waktu?
9. Apakah dibutuhkan uji coba A/B untuk naskah atau jadwal pengiriman?
10. Bagaimana jika pelanggan ingin berbicara dengan agen? Siapa yang menerimanya dan bagaimana penjadwalan ulang?
11. Sistem apa yang perlu dihubungkan (CRM, penagihan, pembayaran, OTP)?
12. Bagaimana kualitas data kontak (nomor aktif, email valid) dipastikan?
13. Berapa volume pesan/panggilan per hari, dan bagaimana menangani lonjakan?
14. Apakah ada aturan atau batasan regulator yang harus dipatuhi (DNC, template WhatsApp, isi promosi)?
15. Bagaimana menghindari penandaan spam dan menjaga reputasi pengirim?
16. Siapa pemilik kampanye, sponsor, dan penentu keputusan?
17. Apakah ada pelatihan atau panduan untuk tim yang menjalankan kampanye?
18. Laporan apa yang dibutuhkan untuk memantau hasil (harian, mingguan, real time)?
19. Risiko apa yang mungkin terjadi (keluhan pelanggan, biaya tinggi), dan bagaimana mitigasinya?
20. Dapatkah skenario, template, dan konektor dipakai ulang untuk kampanye lain?

**(Voicebot – Inbound – Komplain)**
Pertanyaan – Product:
1. Jenis komplain utama apa yang ditangani; apakah ada kategori prioritas?
2. Apakah solusi hanya intake data komplain atau juga membantu melengkapi data secara otomatis?
3. Sistem apa yang terhubung (ticketing/CRM, identity verification/OTP)?
4. Bagaimana kebijakan handover ke agent setelah intake; data apa yang wajib dibawa?
5. Ada persyaratan compliance/regulator (audit, jejak kasus, consent)?
6. Bagaimana bahasa/tone yang diharapkan saat menangani komplain?
7. Siapa owner proses dan tim yang bertanggung jawab pada resolusi komplain?

Pertanyaan – Current Condition (atau estimasi jika layanan baru):
8. Berapa persentase panggilan komplain terhadap total inbound saat ini?
9. Berapa AHT rata-rata untuk komplain di agent?
10. Berapa waktu buka tiket komplain (end-to-end) saat ini?
11. Berapa rasio tiket komplain yang datanya tidak lengkap (mengakibatkan rework)?
12. Berapa volume komplain per hari/bulan; ada pola puncak?
13. Ada SLA regulasi atau internal untuk penyelesaian komplain?
14. Berapa jumlah agent/FTE yang menangani komplain?
15. Ada metrik kualitas (CSAT/NPS) atau repeat complaints yang relevan?
16. Bagaimana tingkat rework/bolak-balik saat komplain (persentase/indikasi)?
17. Ada kendala integrasi ticketing/CRM yang berdampak pada kecepatan intake?
18. Ada baseline biaya operasional yang bisa dirujuk (opsional)?
19. Jika data tidak lengkap, berikan estimasi konservatif untuk volume/AHT/rework.
20. Adakah pain point spesifik yang ingin diatasi pertama kali?

**(Voicebot – Inbound – Permintaan)**
Pertanyaan – Product:
1. Jenis permintaan apa yang ditangani (mis. reset, perubahan data, upgrade, penonaktifan)?
2. Apakah targetnya otomatis end-to-end atau kombinasi otomatis + approval manual?
3. Sistem backend apa saja yang harus diintegrasikan (CRM, core/billing, ERP)?
4. Apakah diperlukan strong auth/OTP sebelum eksekusi permintaan?
5. Batasan kebijakan/limit apa yang berlaku untuk tiap jenis permintaan?
6. Bagaimana kebijakan handover ke agent bila otomatisasi tidak bisa dilanjutkan?
7. Siapa owner proses dan tim operasional yang mengurus eksekusi?

Pertanyaan – Current Condition (atau estimasi jika layanan baru):
8. Berapa volume permintaan per hari/bulan dan pola puncak?
9. Berapa waktu proses rata-rata per permintaan saat ini (end-to-end)?
10. Berapa SLA target saat ini untuk penyelesaian permintaan?
11. Berapa tingkat rework/bolak-balik pada permintaan (mis. data kurang, approval tertunda)?
12. Berapa persentase permintaan yang sebenarnya eligible untuk otomatisasi penuh?
13. Ada kendala integrasi yang signifikan (API/performance/kuota) di sistem backend?
14. Ada metrik kualitas kepuasan atau komplain terkait permintaan?
15. Berapa jumlah agent/FTE yang menangani permintaan secara manual?
16. Ada baseline biaya operasional yang bisa dirujuk (opsional)?
17. Jika data tidak lengkap, berikan estimasi konservatif untuk volume/waktu/SLA/rework.
18. Apa pain point utama yang diutamakan untuk diatasi?
19. Apakah ada jenis permintaan prioritas yang ingin dijalankan sebagai pilot?
20. Ada risiko atau dependensi khusus yang perlu dicatat sejak awal?

**(Chatbot)**
1. Apa tujuan bisnis utama chatbot (deflection, CSAT, penjualan, self‑service) dan target KPI‑nya?
2. Siapa audiens utama dan use case prioritas; intent apa yang paling sering muncul?
3. Kanal apa saja yang didukung (web, WhatsApp, mobile, email) dan alasan prioritas kanal tersebut?
4. Bahasa/lokal dan gaya komunikasi apa yang diharapkan; bagaimana persona/tone bot ditetapkan?
5. Sistem apa yang perlu diintegrasikan (CRM, order, pembayaran, OTP, knowledge base), dan apakah API/akses tersedia?
6. Sumber pengetahuan apa yang dipakai (FAQ, SOP, KB, dokumen), bagaimana kualitas dan proses pembaruannya?
7. Bagaimana alur authoring, review, dan publishing konten, termasuk SLA pembaruan konten?
8. Seperti apa desain alur percakapan (greeting, tangkap intent, klarifikasi, tindakan, penutup) untuk use case utama?
9. Kebutuhan personalisasi apa (nama, status akun, histori) dan batas privasi yang harus dipatuhi?
10. Kapan dan bagaimana verifikasi identitas/otentikasi dilakukan (OTP, SSO) sebelum tindakan transaksi?
11. Kriteria handover ke agen manusia apa yang digunakan, data apa yang diteruskan, dan bagaimana SLA‑nya?
12. Guardrails & moderasi jawaban apa yang diperlukan (anti‑hallucination, sumber kutipan, blokir konten terlarang)?
13. Bagaimana penanganan kesalahan/ketidakpastian (minta klarifikasi, konfirmasi langkah, retry) agar aman dan jelas?
14. Target latensi p95/p99 yang dapat diterima berapa, dan strategi caching/optimasi apa yang direncanakan?
15. Perkiraan volume/konkurensi puncak berapa, dan bagaimana skala horizontal, rate‑limit, dan backpressure diterapkan?
16. Metrik monitoring & analytics apa yang dipantau (intent hit rate, resolution rate, CSAT, drop‑off, top fails)?
17. Pelatihan tim & SOP operasional apa saja, termasuk prosedur eskalasi dan perbaikan konten berkelanjutan?
18. Kebijakan kepatuhan & keamanan apa (PII/PCI, consent, retensi, audit trail, akses berjenjang) yang wajib diikuti?
19. Estimasi biaya per interaksi bagaimana, dan opsi optimasi (LLM, hosting, prompt/adapter, traffic) apa yang dipertimbangkan?
20. Bagaimana rencana pilot/A‑B test, metrik lulus/gagal, strategi rollout bertahap, dan rollback jika ada masalah?

**(KMS AI (stand alone-> buat platform sendiri))**
1. Siapa pengguna utama (agen, operator, pelanggan internal), dan kebutuhannya?
2. Sumber konten apa saja untuk knowledge base (FAQ, SOP, artikel, manual)?
3. Bagaimana proses authoring, review, dan publishing konten dilakukan saat ini?
4. Struktur/taksonomi konten seperti apa (kategori, tag, entitas, hubungan)?
5. Standar kualitas konten apa yang dipakai (akurasi, kedaluwarsa, gaya bahasa)?
6. Bagaimana kebijakan versi, riwayat perubahan, dan rollback konten?
7. Mekanisme pencarian & retrieval apa yang diinginkan (keyword, semantik, embedding/RAG)?
8. Bahasa/lokal apa yang harus didukung dan bagaimana konsistensi terminologinya?
9. Bagaimana integrasi identitas & akses (SSO, RBAC, peran/level visibilitas)?
10. Bagaimana alur feedback pengguna (rating, komentar, suggested edit) dan triase?
11. Bagaimana menangani konten sensitif/PII/PCI dan kebutuhan redaksi di jawaban?
12. Bagaimana SLA pembaruan konten ditetapkan—siapa owner, kapan diupdate, dan apa pemicu perubahannya?
13. Integrasi apa yang diperlukan (CRM, ticketing, telephony, omni-channel, search internal)?
14. Apakah ada kebutuhan pembelajaran model (fine-tune/adapter) atau cukup prompt/RAG?
15. KPI chatbot & KB apa yang dipantau (deflection, helpfulness, CSAT, hit rate)?
16. Guardrails moderasi jawaban apa yang dibutuhkan (sumber kutipan, anti-hallucination)?
17. Target performa & skala (latensi p95/p99, peak concurrency, caching/autoscale)?
18. Observabilitas dan jejak audit apa yang dibutuhkan (query log, sumber konten, versi model)?
19. Berapa estimasi biaya per interaksi, dan strategi optimasi apa yang dipertimbangkan (hosting, LLM, storage, CDN)?
20. Seperti apa rencana onboarding/pelatihan pengguna dan dokumentasi platform (admin dan pengguna akhir)?

**(KMS AI (embedded on OmniX))**
1. Use case utama apa di OmniX yang akan di‑embed (chat, ticketing, knowledge)?
2. Bagaimana titik integrasi dan UX dirancang (widget/panel, jawaban kontekstual, navigasi pengguna)?
3. Bagaimana sinkronisasi KB & metadata OmniX (source of truth, frekuensi, konflik)?
4. Bagaimana mekanisme context injection (customer, case, product) ke chatbot agar relevan?
5. Bagaimana penerapan hak akses berbasis peran (RBAC) di OmniX untuk visibilitas konten dan pembatasan tindakan?
6. Event/pemicu rekomendasi apa yang digunakan (intent, status kasus, macro), dan bagaimana prioritas respons ditentukan?
7. Bagaimana logging dan analytics di OmniX diatur (deflection, waktu hemat, adopsi, kepuasan)?
8. Bagaimana penanganan multi‑kanal (WA, webchat, email) via OmniX dilakukan agar jawaban konsisten?
9. Bagaimana alur fallback ke agen dan pembuatan tiket otomatis (alur, data yang dikirim, SLA)?
10. Bagaimana penggunaan template jawaban/macro OmniX dan kontrol kualitas kontennya?
11. Bagaimana governance perubahan konten lintas tim (approval chain, siapa menyetujui apa)?
12. Bagaimana kepatuhan dan privasi diterapkan di OmniX (consent, redaksi PII, retensi data)?
13. Berapa target latensi dan SLO di OmniX; apa batas p95/p99 dan strategi pemenuhannya?
14. Bagaimana menjaga performa saat beban puncak (queueing/backpressure, retry, degradasi terkontrol)?
15. Bagaimana A/B test naskah/jawaban dilakukan dan apa dampaknya ke KPI di OmniX (deflection, CSAT)?
16. Bagaimana rencana rollout bertahap dan rollback di OmniX (pilot, canary, success criteria)?
17. Bagaimana integrasi ke API OmniX terkait knowledge (read/write, audit, versioning)?
18. Bagaimana monitoring error, rate‑limit, dan penanganan kuota layanan dilakukan di OmniX?
19. Program pelatihan operasional apa untuk pengguna OmniX dan seperti apa dokumentasi bantuan di produk?
20. Apa rencana ekspansi fitur (recommendation, summarization, auto‑fill) dalam ekosistem OmniX?

**(Auto KIP (Komplain informasi permintaan))**
1. Apa saja jenis komplain, permintaan informasi, atau layanan yang akan dilayani, dan bagaimana kategori, tingkat prioritas, serta definisinya ditetapkan?
2. Bagaimana proses identifikasi pengguna dilakukan (mis. verifikasi/OTP) dan bagaimana consent dicatat, serta data apa saja yang boleh diminta sesuai kebijakan?
3. Bukti/attachment apa yang harus dikumpulkan (foto/dokumen), dan bagaimana ketentuan format, ukuran, serta validasi kelengkapan diterapkan?
4. Apa kebijakan SLA per kategori, termasuk target waktu respons dan resolusi, serta kriteria lulus/gagal kasus?
5. Bagaimana mekanisme routing dan eskalasi, kapan kasus dialihkan ke agen manusia, dan data apa saja yang wajib disertakan saat handover?
6. Bagaimana integrasi dengan sistem tiket/CRM (nomor tiket, status), dan melalui kanal apa pengguna menerima notifikasi dan pembaruan?
7. Template intake apa yang digunakan, mana data wajib vs opsional, dan bagaimana validasi untuk mengurangi bolak‑balik dengan pengguna?
8. Bahasa apa saja yang didukung, gaya/tone respons yang diharapkan, dan kebutuhan aksesibilitas (mis. WCAG) yang harus dipenuhi?
9. Bagaimana kebijakan anti‑abuse diterapkan (rate limiting, pencegahan spam/duplikasi), dan bagaimana penanganan daftar hitam/blacklist?
10. Apa aturan privasi yang berlaku, bagaimana redaksi PII dilakukan, dan siapa yang berhak mengakses data beserta jejak auditnya?
11. Kapan verifikasi tambahan diperlukan (OTP, dokumen identitas), bagaimana alurnya, dan apa fallback jika verifikasi gagal?
12. Bagaimana status kasus diperbarui otomatis (progress, pengingat SLA) melalui kanal pilihan pengguna?
13. Kapan sistem meminta klarifikasi tambahan, berapa batas interaksi per sesi, dan berapa waktu tunggu yang optimal?
14. KPI apa yang dipantau (tingkat resolusi, kepuasan, waktu respons, tingkat pengulangan kasus) dan bagaimana cara pengukurannya?
15. Apa kebijakan untuk konten sensitif/khusus (hukum, reputasi), termasuk persetujuan tambahan yang diperlukan?
16. Apa rencana fallback operasional bila sistem terganggu (mis. antrean manual, prosedur darurat), dan bagaimana dijalankan?
17. Bagaimana pelaporan harian/mingguan disusun, dan bagaimana klasifikasi akar masalah dipakai untuk perbaikan berkelanjutan?
18. Seperti apa peta keputusan dan workflow per kategori, serta tindakan standar apa yang dapat diotomasi?
19. Program pelatihan apa untuk operator, dan bagaimana loop feedback pengguna diintegrasikan untuk peningkatan berkelanjutan?
20. Bagaimana desain pilot/uji coba disiapkan (baseline metrik, eksperimen A/B, success criteria), dan siapa penanggung jawabnya?

**(Doc AI – Extraction)**
1. Dokumen apa yang akan diproses (misalnya faktur, PO, kontrak), dan informasi apa yang perlu diambil?
2. Mengapa otomatisasi ekstraksi penting bagi bisnis saat ini?
3. Bagaimana proses manual dilakukan saat ini, dan di bagian mana sering terjadi kesalahan?
4. Target keberhasilan apa yang diinginkan (akurasi per kolom, kecepatan proses, dan tingkat otomatis tanpa koreksi)?
5. Seberapa bervariasi format dokumennya? Apakah sering berubah?
6. Dari mana dokumen diperoleh, dan bagaimana cara kami mengaksesnya?
7. Bagaimana kualitas gambar atau scan (jelas/tidak, miring, terpotong)?
8. Apakah sudah ada data contoh yang diberi label untuk melatih atau menguji?
9. Bagaimana cara memeriksa kebenaran hasil (misalnya cocok dengan PO/GR atau referensi lain)?
10. Kapan perlu melibatkan petugas untuk memeriksa hasil yang ragu? Siapa yang menanganinya?
11. Sistem apa yang akan menerima hasil ekstraksi (ERP, sistem arsip, atau workflow)?
12. Apakah ada data sensitif yang harus disamarkan atau dilindungi?
13. Berapa banyak dokumen yang diproses per hari, dan kapan terjadinya puncak?
14. Bagaimana cara memantau akurasi dan memperbaiki jika kualitas menurun?
15. Komponen mana yang bisa dibuat umum agar dapat dipakai untuk jenis dokumen lain?
16. Apakah ada rencana memperluas cakupan (dokumen baru, bahasa baru)?
17. Siapa pemilik proses, sponsor, dan penentu keputusan?
18. Perubahan apa yang perlu dilakukan pada SOP dan pelatihan pengguna?
19. Risiko utama apa yang perlu diwaspadai (misalnya biaya OCR, dokumen sulit dibaca), dan apa rencana cadangannya?
20. Ahli mana yang perlu dilibatkan (pemilik proses, validator, integrator)?

**(Doc AI – Summarization)**
1. Siapa yang akan membaca ringkasan dan keputusan apa yang akan dibantu?
2. Dokumen atau sumber apa yang akan diringkas (email, laporan, transkrip, kontrak)?
3. Seperti apa bentuk ringkasan yang diinginkan (poin-poin atau paragraf) dan seberapa panjangnya?
4. Gaya bahasa seperti apa yang diharapkan (formal, ringkas, ramah)?
5. Bagaimana kualitas sumber saat ini (ada kesalahan OCR/ASR, bagian yang hilang)?
6. Informasi apa yang tidak boleh dibocorkan dan perlu disamarkan?
7. Kriteria apa yang menentukan ringkasan sudah baik (akurat, lengkap, sesuai konteks)?
8. Apakah perlu menambahkan hasil lain seperti daftar tindakan, sentimen, atau penanda entitas penting?
9. Seberapa cepat ringkasan harus tersedia, terutama pada jam sibuk?
10. Bagaimana ringkasan akan dibagikan atau digunakan (email, CRM, dashboard)?
11. Siapa yang meninjau dan menyetujui ringkasan sebelum digunakan?
12. Bagaimana cara mencatat perubahan jika ringkasan diedit secara manual?
13. Apakah ada istilah khusus perusahaan yang harus konsisten digunakan?
14. Apakah ada rencana menambah jenis dokumen yang akan diringkas di tahap berikutnya?
15. Siapa pemilik proses, sponsor, dan penentu keputusan?
16. Risiko apa yang perlu diperhatikan (ringkasan tidak akurat, kebocoran data) dan bagaimana menguranginya?
17. Bagaimana biaya per ringkasan akan dipantau dan dioptimalkan?
18. Apakah ada target penggunaan (berapa ringkasan per hari) dan cara memantau kepatuhan SLA?
19. Apakah pengguna membutuhkan contoh ringkasan ideal sebagai acuan?
20. Apakah perlu pelatihan singkat bagi tim yang akan menggunakan atau meninjau ringkasan?

**(Doc AI – Verification)**
1. Informasi apa yang perlu diverifikasi, dan apa sumber kebenarannya?
2. Aturan apa yang digunakan untuk menyatakan data 'sesuai' atau 'tidak sesuai'?
3. Data rujukan apa yang dipakai dan seberapa mutakhir data tersebut?
4. Kapan kasus perlu ditinjau manusia, dan bagaimana alurnya?
5. Sistem apa yang harus terhubung untuk melakukan verifikasi dan mencatat hasilnya?
6. Apakah ada data pribadi atau rahasia yang perlu perlindungan khusus?
7. Seberapa cepat verifikasi harus selesai, terutama saat volume tinggi?
8. Bagaimana jika format data rujukan berubah—apa rencana penyesuaiannya?
9. Bagaimana cara memantau kualitas hasil verifikasi dari waktu ke waktu?
10. Bagaimana menangani kesalahan atau kegagalan (misalnya sumber tidak bisa diakses)?
11. Bagaimana cara mengendalikan biaya per verifikasi tanpa mengurangi kualitas?
12. Siapa yang bertanggung jawab atas aturan dan perubahan proses?
13. Bagian mana yang bisa dibuat umum agar bisa dipakai untuk verifikasi lain?
14. Target layanan apa yang disepakati (SLA/SLO) untuk verifikasi?
15. Bagaimana aturan keamanan akses diterapkan (hak akses, kata sandi, kunci)?
16. Bagaimana kualitas data masukan yang akan diverifikasi?
17. Apa syarat minimal agar proses boleh digunakan di produksi?
18. Risiko utama apa yang harus diantisipasi, dan bagaimana rencana cadangannya?
19. Siapa saja yang perlu dilatih mengenai proses verifikasi baru ini?
20. Ahli mana yang perlu dilibatkan untuk merancang verifikasi yang tepat?

**(Doc AI – Matching)**
1. Pasangan data atau dokumen apa yang perlu dicocokkan, dan untuk tujuan apa?
2. Kriteria apa yang menyatakan dua data itu cocok atau tidak cocok?
3. Data apa saja yang tersedia untuk membantu pencocokan?
4. Apakah ada variasi penulisan, salah ketik, atau hasil scan yang perlu dinormalisasi?
5. Kapan perlu melibatkan manusia untuk memeriksa kasus yang meragukan?
6. Sistem apa yang akan menerima hasil pencocokan, dan bagaimana mencegah duplikasi?
7. Seberapa cepat hasil pencocokan dibutuhkan saat volume tinggi?
8. Informasi pribadi apa yang muncul dalam proses, dan bagaimana melindunginya?
9. Bagaimana cara memantau ketepatan pencocokan dari waktu ke waktu?
10. Bagaimana mengendalikan biaya proses pencocokan?
11. Kesalahan seperti apa yang paling merugikan (salah cocok atau tidak tertangkap), dan bagaimana menyeimbangkannya?
12. Bagian mana yang bisa dipakai ulang untuk jenis pencocokan lain?
13. Siapa yang bertanggung jawab memutuskan perubahan aturan atau ambang?
14. Apa syarat minimal agar sistem pencocokan boleh digunakan di produksi?
15. Bagaimana cara menelusuri riwayat data dan keputusan yang diambil?
16. Kasus tepi atau bias apa yang perlu diperhatikan?
17. Target waktu selesai end-to-end yang diharapkan berapa?
18. Siapa ahli yang perlu dilibatkan untuk menilai kualitas hasil?
19. Apakah ada rencana memperluas jenis data/dokumen yang dicocokkan di tahap berikutnya?
20. Bagaimana rencana pelatihan pengguna yang akan meninjau hasil pencocokan?

**(Doc AI – Classification)**
1. Dokumen apa yang akan diklasifikasikan (jenis, sumber, contoh) dan tujuan bisnisnya?
2. Bagaimana Anda mendefinisikan kelas dokumen serta batasannya (apakah multi-class, multi-label, atau hierarki)?
3. Apakah ada sub-kelas atau atribut tambahan (prioritas, sensitivitas, status proses) yang perlu diidentifikasi?
4. Dari mana data bersumber dan berapa volume per kelas; seberapa representatif dan seimbangkah distribusi kelasnya?
5. Bagaimana kualitas dokumen yang akan diproses (format PDF/scan/email, adakah error OCR/ASR, resolusi, noise)?
6. Fitur apa yang akan digunakan (teks isi, layout/struktur, metadata, header/footer, elemen visual)?
7. Aturan deterministik (regex/rule) seperti apa yang bisa melengkapi model dan kapan aturan tersebut digunakan?
8. Apa pedoman anotasi/labeling-nya; bagaimana contoh edge case dan cara menyelesaikan konflik antar anotator?
9. Bagaimana proses labeling berlangsung (tool apa, QA dua tahap, bagaimana inter-annotator agreement/Cohen’s kappa)?
10. Kebijakan pembagian data train/val/test seperti apa; apakah dilakukan stratifikasi per kelas & periode waktu?
11. Metrik evaluasi apa yang dipakai (accuracy, macro/micro F1, per-class recall) dan target lulus/gagalnya?
12. Threshold confidence berapa; kebijakan fallback (manual review) seperti apa bila confidence rendah?
13. Bagaimana mendeteksi out-of-distribution/unknown class; kebijakan “Other” dan triase-nya?
14. Pipeline dari ingestion → preprocessing (OCR/normalisasi) → inference → posting hasil seperti apa?
15. Bagaimana integrasi output ke sistem downstream (ERP/ECM/workflow); format & ID referensi yang digunakan?
16. Kebijakan kepatuhan & privasi seperti apa (redaksi PII/PCI, retensi data, akses berjenjang, audit trail)?
17. Target performa & throughput berapa (latensi p95/p99, batch vs streaming, skala saat puncak)?
18. Bagaimana monitoring online-nya (drift, perubahan imbalance, confusion matrix berkala)?
19. Berapa biaya operasional per dokumen; opsi optimasi apa yang bisa diterapkan (caching, quantize, batching)?
20. Apa rencana perluasan (kelas baru, bahasa tambahan, wilayah); kriteria Go/No-Go & prosedur rollback-nya?

**(RPA)**
1. Proses apa yang ingin diotomasi dan hasil apa yang diharapkan?
2. Mengapa proses ini penting untuk ditingkatkan sekarang?
3. Bagaimana proses dilakukan saat ini, dan di bagian mana sering macet?
4. Langkah mana yang paling cocok diotomasi terlebih dahulu?
5. Aplikasi apa saja yang digunakan dan apakah stabil untuk diotomasi?
6. Bagaimana pengelolaan akses dan keamanan untuk bot?
7. Data input dan output apa yang dipakai, dan bagaimana memeriksa kebenarannya?
8. Kapan proses berjalan paling sibuk dan bagaimana penjadwalannya?
9. Kapan perlu campur tangan manusia, dan seperti apa alurnya?
10. Bagaimana rencana menangani kesalahan dan mencoba ulang?
11. Bagaimana proses akan dipantau dan diberi peringatan jika ada masalah?
12. Biaya apa saja yang perlu diperhitungkan (lisensi, server, pemeliharaan)?
13. Apakah ada data sensitif yang perlu perlindungan khusus?
14. Perubahan SOP dan pelatihan apa yang diperlukan?
15. Bagaimana rencana mengukur manfaat dan penghematan secara nyata?
16. Komponen apa yang bisa dibuat sebagai template untuk proses lain?
17. Apakah ada rencana memperluas otomasi ke proses lain?
18. Siapa pemilik proses, sponsor, dan penentu keputusan?
19. Risiko utama apa yang mungkin terjadi, dan apa rencana cadangannya?
20. Siapa ahli yang perlu dilibatkan (pemilik proses/aplikasi)?

**(Proctoring AI)**
1. Ujian atau aktivitas apa yang perlu diawasi, dan risiko apa yang ingin dikendalikan?
2. Perangkat apa saja yang digunakan peserta (kamera, mikrofon, layar), dan bagaimana kondisinya?
3. Perilaku apa yang dianggap pelanggaran, dan bagaimana mendeteksinya?
4. Siapa yang meninjau dugaan pelanggaran dan bagaimana proses keputusannya?
5. Apakah peserta setuju direkam, dan bagaimana pengelolaan data rekamannya?
6. Bagaimana memastikan keadilan untuk pencahayaan, budaya, atau kondisi khusus peserta?
7. Bagaimana mencegah kebocoran soal atau kecurangan teknis?
8. Berapa banyak peserta yang diawasi bersamaan dan bagaimana menjaga kinerja sistem?
9. Spesifikasi minimal perangkat dan jaringan apa yang disarankan?
10. Bagaimana menangani salah deteksi atau pelanggaran yang diragukan?
11. Bagaimana sistem terhubung dengan LMS/portal dan verifikasi identitas peserta?
12. Informasi apa yang disimpan sebagai bukti dan bagaimana jejak auditnya?
13. Berapa lama bukti disimpan dan siapa yang boleh mengaksesnya?
14. Bagaimana pengalaman pengguna dibuat jelas sebelum ujian (panduan dan uji coba)?
15. Pelatihan apa yang diperlukan untuk tim pengawas?
16. Langkah keamanan apa yang dipakai untuk mencegah manipulasi perangkat lunak?
17. Bagaimana mengelola biaya per sesi pemantauan?
18. Siapa pemilik program, sponsor, dan target jadwal penerapan?
19. Risiko hukum atau reputasi apa yang mungkin muncul, dan bagaimana mitigasinya?
20. Apakah solusi ini bisa dipakai di program atau negara lain?

**(CC AI – Komplit: Inbound & Outbound)**
1. Apa tujuan bisnis utama dari gabungan inbound dan outbound (mis. deflection, AHT/FCR/CSAT, RPC/konversi)?
2. Siapa segmen pelanggan utamanya dan kapan mereka biasanya menghubungi atau dihubungi?
3. KPI apa yang dipakai untuk menilai pilot dan skala (sertakan ambang lulus/gagal)?
4. Berapa volume panggilan masuk per hari dan kapan jam puncaknya?
5. Kapan dan seberapa sering kita boleh menghubungi pelanggan (consent, DNC, opt-out, quiet hours)?
6. Bagaimana pelanggan masuk ke sistem (bot/IVR) dan bagaimana panggilan diarahkan ke tujuan yang tepat?
7. Bagaimana proses verifikasi identitas untuk inbound dan outbound dilakukan secara konsisten?
8. Konten apa yang dibutuhkan (FAQ, skrip, knowledge base, template) dan siapa yang menyetujuinya?
9. Transaksi apa saja yang ingin diotomasi end-to-end (mis. status pesanan, pembayaran, pengaduan)?
10. Kapan bot harus menyerahkan ke agen, dan data apa yang perlu diteruskan ke agen saat handover?
11. Bagaimana strategi urutan kanal dan frekuensi kirim agar efektif tanpa memicu spam atau blokir?
12. Data apa yang tersedia (audio, transkrip, log CRM/kampanye) dan bagaimana akses serta retensinya diatur?
13. Bagaimana kualitas data yang ada (noise/dialek pada ASR, konsistensi label intent, validitas nomor kontak)?
14. Kebijakan privasi dan keamanan apa yang berlaku (rekaman, enkripsi, PII/PCI, data residency)?
15. Pelatihan dan perubahan SOP apa yang dibutuhkan untuk agen dan operator outbound?
16. Risiko utama apa yang diantisipasi dan bagaimana rencana mitigasinya?
17. Laporan atau analitik terpadu apa yang diperlukan untuk memantau inbound dan outbound?
18. Target kinerja dan biaya apa yang ingin dicapai (latensi p95/p99, kapasitas, biaya per interaksi)?
19. Bagaimana rencana uji coba (A/B), ukuran sampel, serta kriteria lulus/gagalnya?
20. Siapa pemilik, sponsor, hak keputusan, dan komponen mana yang bisa dipakai ulang lintas unit/brand?

**(Doc AI – Gabungan: Extraction + Summarization + Verification + Matching)**
1. Dokumen apa yang diproses dan keputusan bisnis apa yang ingin dibantu?
2. Field utama apa yang harus diekstrak dan berapa target akurasinya?
3. Dari mana dokumen datang (email, portal, scan, API) dan dalam format apa?
4. Bagaimana kualitas sumber saat ini (DPI, kemiringan, noise, error OCR/ASR)?
5. Apakah tersedia data label/ground truth untuk pelatihan dan pengujian?
6. Ringkasan seperti apa yang dibutuhkan (siapa audiens, panjang, gaya bahasa)?
7. Aturan verifikasi apa yang digunakan dan sumber kebenaran mana yang dirujuk?
8. Pencocokan apa yang diperlukan (mis. invoice-PO, KTP-selfie) dan berapa ambang kelulusannya?
9. Kapan kasus perlu ditinjau manusia dan bagaimana alur serta SLA peninjauannya?
10. Kebijakan privasi apa yang wajib dipatuhi (redaksi PII, retensi, kontrol akses, audit)?
11. Sistem apa yang akan diintegrasikan untuk input dan output (ingestion, transform, posting ke ERP/ECM/workflow)?
12. Kriteria go/no-go apa yang disepakati (akurasi per field, STP, latensi, exception rate)?
13. Bagaimana rencana monitoring kualitas dan audit trail end-to-end dijalankan?
14. Bagaimana penanganan error, perubahan format, atau sumber referensi yang tidak tersedia?
15. Target kapasitas, latensi, dan biaya per dokumen apa yang diinginkan?
16. Komponen apa yang bisa dibuat reusable (template, kamus/taxonomy, embedding/index, konektor)?
17. Apa rencana ekspansi berikutnya (jenis dokumen, bahasa, wilayah) dan dependensinya?
18. Risiko utama apa yang mungkin terjadi (scan buruk, mismatch, hallucination) dan apa fallback operasionalnya?
19. Siapa peran kunci (process owner, labeling lead, data/ML, integrasi) dan siapa yang memutuskan perubahan aturan?
20. Bagaimana desain pilot disiapkan (pembagian dataset, baseline/A-B) dan metrik manfaat bisnis yang akan diukur?

`;
