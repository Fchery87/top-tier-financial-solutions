import * as React from 'react';

export function useWizardOperationError() {
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = React.useState(false);

  const showOperationError = React.useCallback((message: string) => {
    setOperationError(message);
    setShowErrorModal(true);
  }, []);

  return {
    operationError,
    setOperationError,
    showErrorModal,
    setShowErrorModal,
    showOperationError,
  };
}
