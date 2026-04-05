export function profileApprovedHtml(fullName: string): string {
  return `
<p>Selamat <strong>${fullName}</strong>! Profil SSW Anda telah disetujui oleh tim IJBNet.</p>
<p>Profil Anda kini dapat dilihat oleh perusahaan rekanan Jepang.</p>
`;
}

export const profileApprovedSubject = '[IJBNet] Profil Anda telah disetujui';
