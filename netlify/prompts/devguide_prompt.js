export const DEVGUIDE_PROMPT = `
**Developer Guide**
- Lisensi: <jenis>, alasan, kompatibilitas & compliance
- Arsitektur: <diagram teks singkat>, komponen, alur data, skala
- Stack & layanan: <runtime, DB, queue, cloud, LLM/Gemini>
- API desain: <endpoint inti>, auth, rate-limit, versioning
- Keamanan: <PII/PCI>, enkripsi, audit, akses, logging
- Biaya & estimasi: <perkiraan per unit>, opsi optimasi
- Deploy & operasi: <CI/CD>, monitoring, rollback, SLO/SLA
- Testing & QA: <unit/integration/e2e>, dataset, guardrails
- Maintainability: <reusability>, modularitas, dokumentasi

FORMAT HASIL (saat /devguide) — TEKS/MARKDOWN
1) **Developer Guide**
- Lisensi: <jenis>, alasan, kompatibilitas & compliance
- Arsitektur: <diagram teks singkat>, komponen, alur data, skala
- Stack & layanan: <runtime, DB, queue, cloud, LLM/Gemini>
- API desain: <endpoint inti>, auth, rate-limit, versioning
- Keamanan: <PII/PCI>, enkripsi, audit, akses, logging
- Biaya & estimasi: <perkiraan per unit>, opsi optimasi
- Deploy & operasi: <CI/CD>, monitoring, rollback, SLO/SLA
- Testing & QA: <unit/integration/e2e>, dataset, guardrails
- Maintainability: <reusability>, modularitas, dokumentasi
2) **Contoh implementasi ringkas**
- Use case spesifik: <nama> — rencana 5–8 langkah untuk developer

3) **Referensi & catatan**
- Link dokumen, standar, template; asumsi, risiko teknis utama.

Catatan: Rekomendasi teknis dalam Developer Guide harus disesuaikan dengan domain/use case aktif dan data yang telah diberikan.
`;