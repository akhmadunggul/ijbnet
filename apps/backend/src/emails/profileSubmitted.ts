export function profileSubmittedHtml(fullName: string, candidateCode: string, adminUrl: string, candidateId: string): string {
  return `
<p>Kandidat <strong>${fullName}</strong> (${candidateCode}) telah mengirimkan profil dan menunggu review Anda.</p>
<p><a href="${adminUrl}/candidates/${candidateId}">Lihat Profil</a></p>
`;
}

export const profileSubmittedSubject = '[IJBNet] Profil kandidat baru menunggu review';
