export function interviewScheduledRecruiterHtml(candidateName: string, finalDate: string): string {
  return `
<p><strong>${candidateName}</strong>様との面接日程が確定しました。</p>
<p>日時: <strong>${finalDate}</strong></p>
`;
}

export const interviewScheduledRecruiterSubject = '[IJBNet] 面接日程が確定しました';

export function interviewScheduledCandidateHtml(fullName: string, companyName: string, finalDate: string): string {
  return `
<p>Halo <strong>${fullName}</strong>, jadwal wawancara Anda dengan <strong>${companyName}</strong> telah dikonfirmasi.</p>
<p>Tanggal: <strong>${finalDate}</strong></p>
<p>Silakan persiapkan diri Anda dengan baik. Tim IJBNet siap membantu jika Anda membutuhkan informasi lebih lanjut.</p>
`;
}

export const interviewScheduledCandidateSubject = '[IJBNet] Jadwal wawancara Anda telah dikonfirmasi';
