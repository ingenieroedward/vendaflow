import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useFeature } from '../../hooks/useFeature';

interface FeatureGateProps {
  feature: string;
  /** Nombre visible del plan mínimo que la trae, para el mensaje ("Pro") */
  planLabel?: string;
  children: React.ReactNode;
}

/**
 * Muestra `children` si el tenant tiene la feature; si no, un card de venta
 * ("Disponible en plan X") en vez de esconder la sección sin más — el
 * usuario debe ver lo que se pierde, no solo un 403.
 */
const FeatureGate: React.FC<FeatureGateProps> = ({ feature, planLabel = 'Pro', children }) => {
  const enabled = useFeature(feature);
  if (enabled) return <>{children}</>;

  return (
    <div className="max-w-lg mx-auto text-center bg-white rounded-xl border border-gray-200 shadow-sm p-8 mt-8">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1.5">Disponible en el plan {planLabel}</h2>
      <p className="text-sm text-gray-500 mb-5">
        Esta función no está incluida en tu plan actual. Escríbenos para activarla en tu cuenta.
      </p>
      <Link
        to="/billing"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
      >
        Ver mi plan
      </Link>
    </div>
  );
};

export default FeatureGate;
