export type StoreLocation = {
  id: string;
  name: string;
  address: string;
  hours: string;
  mapsQuery: string;
};

// Lojas de demonstração para o app piloto.
// Em produção isso viria do cadastro de filiais do supermercado.
export const STORES: StoreLocation[] = [
  {
    id: 's1',
    name: 'Loja Centro',
    address: 'Rua das Flores, 123 — Centro',
    hours: '08h às 22h, todos os dias',
    mapsQuery: 'Rua das Flores, 123, Centro',
  },
  {
    id: 's2',
    name: 'Loja Shopping Norte',
    address: 'Av. Brasil, 4500 — Shopping Norte, Loja 210',
    hours: '10h às 22h, todos os dias',
    mapsQuery: 'Av. Brasil, 4500, Shopping Norte',
  },
  {
    id: 's3',
    name: 'Loja Jardins',
    address: 'Rua Itália, 890 — Jardins',
    hours: '07h às 23h, todos os dias',
    mapsQuery: 'Rua Itália, 890, Jardins',
  },
];
