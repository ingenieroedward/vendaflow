import React from 'react';
import { Printer } from 'lucide-react';
import Button from './Button';

interface PrintButtonProps {
  onPrint: () => void;
  className?: string;
  disabled?: boolean;
}

const PrintButton: React.FC<PrintButtonProps> = ({ onPrint, className, disabled }) => {
  return (
    <Button
      variant="outline"
      icon={Printer}
      onClick={onPrint}
      className={className}
      disabled={disabled}
      size="sm"
    >
      Imprimir
    </Button>
  );
};

export default PrintButton; 