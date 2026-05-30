import * as React from 'react';

export function useLetterExportActions() {
  const copyToClipboard = React.useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const downloadLetter = React.useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    copyToClipboard,
    downloadLetter,
  };
}
