import { resolveFeatures, PLAN_FEATURES, isFeatureKey } from '../features';

describe('resolveFeatures', () => {
  it('usa el default del plan cuando no hay customFeatures', () => {
    expect(resolveFeatures({ plan: 'basic' })).toEqual(new Set(PLAN_FEATURES.basic));
    expect(resolveFeatures({ plan: 'pro', customFeatures: null })).toEqual(new Set(PLAN_FEATURES.pro));
  });

  it('basic no tiene pos; pro y enterprise sí', () => {
    expect(resolveFeatures({ plan: 'basic' }).has('pos')).toBe(false);
    expect(resolveFeatures({ plan: 'pro' }).has('pos')).toBe(true);
    expect(resolveFeatures({ plan: 'enterprise' }).has('pos')).toBe(true);
  });

  it('trial incluye pos (para que el prospecto lo pruebe)', () => {
    expect(resolveFeatures({ plan: 'trial' }).has('pos')).toBe(true);
  });

  it('customFeatures override completo — un tenant Basic puede tener pos si se negocia', () => {
    const features = resolveFeatures({ plan: 'basic', customFeatures: '["pos"]' });
    expect(features.has('pos')).toBe(true);
    expect(features.size).toBe(1); // NO hereda nada del default de basic (que es vacío igual)
  });

  it('customFeatures puede reducir por debajo del default del plan', () => {
    // Un enterprise al que se le quita multi_warehouse por acuerdo especial
    const features = resolveFeatures({ plan: 'enterprise', customFeatures: '["pos"]' });
    expect(features.has('multi_warehouse')).toBe(false);
    expect(features.has('pos')).toBe(true);
  });

  it('customFeatures con JSON corrupto cae al default del plan sin romper', () => {
    const features = resolveFeatures({ plan: 'pro', customFeatures: '{not valid json' });
    expect(features).toEqual(new Set(PLAN_FEATURES.pro));
  });

  it('customFeatures con valores no reconocidos los descarta silenciosamente', () => {
    const features = resolveFeatures({ plan: 'basic', customFeatures: '["pos", "algo_inventado"]' });
    expect(features.has('pos')).toBe(true);
    expect(features.has('algo_inventado' as any)).toBe(false);
    expect(features.size).toBe(1);
  });

  it('plan inexistente (dato corrupto) no revienta — devuelve set vacío', () => {
    expect(resolveFeatures({ plan: 'inexistente' as any })).toEqual(new Set());
  });
});

describe('isFeatureKey', () => {
  it('valida claves conocidas', () => {
    expect(isFeatureKey('pos')).toBe(true);
    expect(isFeatureKey('custom_branding')).toBe(true);
  });
  it('rechaza claves desconocidas o tipos no-string', () => {
    expect(isFeatureKey('inventado')).toBe(false);
    expect(isFeatureKey(123)).toBe(false);
    expect(isFeatureKey(null)).toBe(false);
  });
});
