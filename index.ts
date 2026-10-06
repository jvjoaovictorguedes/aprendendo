// Ponto de entrada do app. Igual ao expo-router/entry, mas registra o
// BrandedApp, que aplica a marca da franquia antes das telas carregarem.
// `@expo/metro-runtime` TEM que ser o primeiro import (Fast Refresh na web).
import '@expo/metro-runtime';

import { renderRootComponent } from 'expo-router/build/renderRootComponent';

import { BrandedApp } from './src/brand/BrandedApp';

renderRootComponent(BrandedApp);
