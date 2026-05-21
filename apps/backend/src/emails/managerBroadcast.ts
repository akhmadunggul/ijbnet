export function managerBroadcastHtml(
  candidateName: string,
  body: string,
  frontendUrl: string,
): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr>
          <td style="background:#1A2E44;padding:20px 28px;border-radius:8px 8px 0 0">
            <span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">IJBNet</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 8px 8px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Kepada <strong>${candidateName}</strong>,</p>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 16px">
            <div style="color:#374151;font-size:15px;line-height:1.7">${escaped}</div>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px">
            <p style="margin:0;color:#6b7280;font-size:12px">
              Email ini dikirim otomatis oleh IJBNet.
              Untuk melihat semua notifikasi, kunjungi
              <a href="${frontendUrl}/portal/notifications" style="color:#1A2E44">halaman notifikasi Anda</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
