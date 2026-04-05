export function batchActivatedHtml(companyName: string, batchCode: string, limit: number, recruiterUrl: string): string {
  return `
<p>${companyName} 様、新しいバッチ <strong>${batchCode}</strong> が利用可能になりました。</p>
<p>${limit}名の候補者をご選択いただけます。</p>
<p><a href="${recruiterUrl}/selection">選考を開始する</a></p>
`;
}

export const batchActivatedSubject = '[IJBNet] 新しい候補者バッチが利用可能です';
