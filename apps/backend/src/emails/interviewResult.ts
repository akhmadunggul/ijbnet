export function interviewResultHtml(fullName: string, companyName: string, result: 'pass' | 'fail' | 'cancelled'): string {
  if (result === 'pass') {
    return `
<p>Halo <strong>${fullName}</strong>, selamat! Anda telah lulus wawancara dengan <strong>${companyName}</strong>.</p>
<p>Tim IJBNet akan menghubungi Anda untuk langkah selanjutnya.</p>
`;
  }
  if (result === 'fail') {
    return `
<p>Halo <strong>${fullName}</strong>, terima kasih telah mengikuti wawancara dengan <strong>${companyName}</strong>.</p>
<p>Mohon maaf, Anda belum berhasil pada seleksi kali ini.</p>
<p>Kami akan terus membantu Anda menemukan kesempatan yang tepat.</p>
`;
  }
  return `
<p>Halo <strong>${fullName}</strong>, wawancara Anda dengan <strong>${companyName}</strong> telah dibatalkan.</p>
<p>Tim IJBNet akan menghubungi Anda untuk informasi lebih lanjut.</p>
`;
}

export function interviewResultSubject(result: 'pass' | 'fail' | 'cancelled'): string {
  if (result === 'pass') return '[IJBNet] Selamat! Anda lulus wawancara';
  if (result === 'fail') return '[IJBNet] Hasil wawancara Anda';
  return '[IJBNet] Wawancara dibatalkan';
}
