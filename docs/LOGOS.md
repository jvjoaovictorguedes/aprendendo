# Logos dos mercados

Em **Admin → franquia → Marca e dados**, escolha uma imagem, confira a prévia ou remova a logo. Upload e remoção são salvos imediatamente; nome, cor e URL externa continuam usando o botão Salvar. A marca é atualizada na abertura do app, respeitando o cache existente (uma abertura pode ainda usar a marca anterior).

PNG, JPG e WebP são aceitos até 5 MB e 20 megapixels. A API valida e transforma a imagem em WebP, corrige orientação, remove metadados e redimensiona proporcionalmente para até 512 × 512 px, sem ampliar imagens pequenas. Transparência é preservada. O arquivo final fica limitado a 256 KB.

A migração `007_tenant_logos.sql` cria `tenant_logos` no PostgreSQL, com conteúdo binário, dimensões, versão e último administrador responsável. Há uma imagem por franquia, substituída atomicamente com a referência `tenants.logo_url`. Não requer disco persistente no Railway nem serviço externo de arquivos. Esta tabela serve para logos pequenas; não é um repositório de imagens de produtos.

- `POST /admin/tenants/:id/logo`: JSON com `base64`, retorna URL, tamanhos e dimensões.
- `DELETE /admin/tenants/:id/logo`: remove imagem e referência.
- `GET /public/tenant-logos/:id/:revision`: WebP público, cache de uma hora. Versões substituídas, removidas e franquias suspensas retornam 404.

A plataforma gerencia qualquer franquia; lojistas gerenciam somente a sua. Clientes não podem enviar imagens. A URL pública é necessária para exibir a marca antes do login.

O painel web já pode usar o seletor de arquivos após o deploy. O seletor nativo usa `expo-image-picker`: builds instalados anteriores precisam de um novo build para incluir esse módulo. A versão do app foi elevada para 1.0.1 porque `runtimeVersion` usa `appVersion`, evitando enviar atualizações com o novo módulo para binários incompatíveis. Clientes continuam recebendo a logo pela API; mudar a imagem não exige um novo build.
