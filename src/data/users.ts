export type User = {
  id: string;
  name: string;
  cpf: string;
  password: string;
  points: number;
};

// Usuários de demonstração para o app piloto.
// Em produção isso vira uma chamada de login à API do supermercado (nunca senha em texto puro no app).
export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'João Victor',
    cpf: '12345678900',
    password: '123456',
    points: 480,
  },
  {
    id: 'u2',
    name: 'Maria Souza',
    cpf: '98765432100',
    password: '123456',
    points: 1250,
  },
];

export function findUserByCpf(cpf: string): User | undefined {
  return MOCK_USERS.find((user) => user.cpf === cpf);
}
