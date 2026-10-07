import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { fetchDemo, DemoInfo, DEMO_TENANT } from '../services/demo';
import { isApiConfigured, appTenantId } from '../services/api';
const Context = createContext<DemoInfo>({
  enabled: false,
  toolsEnabled: false,
});
export function DemoProvider({ children }: PropsWithChildren) {
  const [info, setInfo] = useState<DemoInfo>({
    enabled: appTenantId === DEMO_TENANT,
    toolsEnabled: false,
  });
  useEffect(() => {
    let cancelled = false;
    if (isApiConfigured)
      fetchDemo()
        .then((next) => {
          if (!cancelled) setInfo(next);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return <Context.Provider value={info}>{children}</Context.Provider>;
}
export const useDemo = () => useContext(Context);
