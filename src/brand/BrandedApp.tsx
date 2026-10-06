import { useEffect, useState } from 'react';
// Mesmo componente raiz que o expo-router/entry registra.
import { App } from 'expo-router/build/qualified-entry';

import { loadBrand } from '../services/brand';
import { applyBrand } from '../theme/tokens';

/**
 * Aplica a marca da franquia (nome, cor, logo) ANTES de montar o Expo
 * Router. As telas só são carregadas quando o roteador monta, então os
 * estilos delas já são criados com a cor da franquia.
 */
export function BrandedApp() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadBrand()
      .then((loaded) => {
        if (loaded) applyBrand(loaded);
      })
      .finally(() => setIsReady(true));
  }, []);

  return isReady ? <App /> : null;
}
